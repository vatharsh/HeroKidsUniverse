import { BadRequestException, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { AiOperation, AiUsageLog } from '../ai/entities/ai-usage-log.entity';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { User } from '../users/user.entity';

const logger = new Logger('AvatarAllowance');

/** Paid for before the image is generated, so parallel requests can't each slip past the balance check. */
export interface AvatarReservation {
  userId: string;
  /** 'free' = one of the account's free hero avatars; 'token' = one Avatar Refresh; 'included' = covered by a character slot. */
  source: 'free' | 'token' | 'included';
  kind: 'hero' | 'character';
  referenceId: string | null;
}

/**
 * Every avatar generation goes through here. Hero avatars use the account's free allowance
 * (FREE_HERO_AVATAR_GENERATIONS — shared by all heroes, so creating/deleting heroes can't mint more),
 * then Avatar Refreshes. Character avatars always use an Avatar Refresh, except the first one when a
 * character is created (paid for by the character slot).
 */
export async function reserveAvatarGeneration(
  dataSource: DataSource,
  userId: string,
  kind: 'hero' | 'character',
  options: { referenceId?: string | null; includedWithSlot?: boolean } = {},
): Promise<AvatarReservation> {
  const referenceId = options.referenceId ?? null;
  if (options.includedWithSlot) return { userId, source: 'included', kind, referenceId };

  const freeHeroAvatars = kind === 'hero' ? await getFreeHeroAvatarLimit(dataSource) : 0;
  return dataSource.transaction(async (manager) => {
    const user = await manager.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
    if (!user) throw new BadRequestException('User not found');

    if (kind === 'hero' && user.heroAvatarGenerationsUsed < freeHeroAvatars) {
      user.heroAvatarGenerationsUsed += 1;
      await manager.save(user);
      return { userId, source: 'free', kind, referenceId };
    }

    if (user.avatarRefreshTokens < 1) {
      throw new BadRequestException(
        kind === 'hero'
          ? `Your ${freeHeroAvatars} free hero avatars have been used. Buy an Avatar Refresh pack to make another.`
          : 'You have no Avatar Refreshes left. Buy an Avatar Refresh pack to try another look.',
      );
    }
    user.avatarRefreshTokens -= 1;
    if (kind === 'hero') user.heroAvatarGenerationsUsed += 1;
    else user.characterAvatarGenerationsUsed += 1;
    await manager.save(user);
    await manager.save(manager.create(CreditTransaction, {
      userId,
      delta: 0,
      reason: CreditTransactionReason.AvatarRefreshUsed,
      referenceId,
      avatarRefreshTokensDelta: -1,
    }));
    return { userId, source: 'token', kind, referenceId };
  });
}

/** Gives back what a failed generation took — a failure never costs the user anything. */
export async function releaseAvatarGeneration(dataSource: DataSource, reservation: AvatarReservation): Promise<void> {
  try {
    await dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: reservation.userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) return;

      if (reservation.source === 'free') {
        user.heroAvatarGenerationsUsed = Math.max(0, user.heroAvatarGenerationsUsed - 1);
        await manager.save(user);
        return;
      }

      // A failed first avatar on a new character gets a free retry: the slot is already spent.
      user.avatarRefreshTokens += 1;
      if (reservation.source === 'token') {
        if (reservation.kind === 'hero') user.heroAvatarGenerationsUsed = Math.max(0, user.heroAvatarGenerationsUsed - 1);
        else user.characterAvatarGenerationsUsed = Math.max(0, user.characterAvatarGenerationsUsed - 1);
      }
      await manager.save(user);
      await refundRow(manager, reservation);
    });
  } catch (err) {
    logger.error(`Could not refund avatar generation for ${reservation.userId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function refundRow(manager: EntityManager, reservation: AvatarReservation) {
  await manager.save(manager.create(CreditTransaction, {
    userId: reservation.userId,
    delta: 0,
    reason: CreditTransactionReason.Refund,
    referenceId: reservation.referenceId,
    avatarRefreshTokensDelta: 1,
  }));
}

/** Avatars were missing from AI cost tracking; record each successful one so spend shows in AI Analytics. */
export async function logAvatarUsage(dataSource: DataSource, userId: string): Promise<void> {
  try {
    const settings = dataSource.getRepository(PlatformSetting);
    const backend = (await settings.findOne({ where: { key: 'AVATAR_GENERATION_BACKEND' } }))?.value ?? 'openai';
    const costKey = backend === 'gemini' ? 'GEMINI_AVATAR_COST_PER_IMAGE' : 'OPENAI_AVATAR_COST_PER_IMAGE';
    const cost = Number((await settings.findOne({ where: { key: costKey } }))?.value ?? SETTING_DEFAULTS[costKey]?.value ?? 0);
    await dataSource.getRepository(AiUsageLog).save({
      userId,
      provider: backend === 'gemini' ? 'gemini' : 'openai',
      model: backend === 'gemini' ? 'gemini-3.1-flash-image' : 'gpt-image-1',
      operation: AiOperation.AvatarGeneration,
      imagesGenerated: 1,
      estimatedCostUsd: Number.isFinite(cost) ? cost : 0,
    });
  } catch (err) {
    logger.warn(`Avatar usage log failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function getFreeHeroAvatarLimit(dataSource: DataSource): Promise<number> {
  const row = await dataSource.getRepository(PlatformSetting).findOne({ where: { key: 'FREE_HERO_AVATAR_GENERATIONS' } });
  const value = Number(row?.value ?? SETTING_DEFAULTS.FREE_HERO_AVATAR_GENERATIONS?.value ?? 3);
  return Number.isFinite(value) ? Math.max(0, value) : 3;
}

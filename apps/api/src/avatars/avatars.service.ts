import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  IMAGE_GENERATION_PROVIDER,
} from '../ai/interfaces/image-generation.provider';
import type {
  ImageGenerationOutput,
  ImageGenerationProvider,
} from '../ai/interfaces/image-generation.provider';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { UploadService } from '../upload/upload.service';
import { User } from '../users/user.entity';
import { UserAvatar } from './entities/user-avatar.entity';

const HERO_AVATAR_MAX      = 2;

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);

  constructor(
    @InjectRepository(UserAvatar)
    private readonly avatarRepo: Repository<UserAvatar>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(IMAGE_GENERATION_PROVIDER)
    private readonly imageProvider: ImageGenerationProvider,
    private readonly uploadService: UploadService,
  ) {}

  async getStats(userId: string) {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const avatars = await this.avatarRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return {
      customAvatars:            avatars.map((a) => a.avatarUrl),
      heroGenerationsUsed:      user.heroAvatarGenerationsUsed,
      heroGenerationsMax:       HERO_AVATAR_MAX,
      avatarRefreshTokens:      user.avatarRefreshTokens,
      characterGenerationsUsed: user.characterAvatarGenerationsUsed,
      characterGenerationsMax:  user.avatarRefreshTokens,
    };
  }

  async generate(
    userId: string,
    photo: Express.Multer.File,
    type: 'hero' | 'character',
    adjustmentHint?: string,
  ): Promise<{ avatarUrl: string }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    if (type === 'hero' && user.heroAvatarGenerationsUsed >= HERO_AVATAR_MAX) {
      throw new BadRequestException('Hero avatar generation limit reached');
    }
    if (type === 'character' && user.avatarRefreshTokens < 1) {
      throw new BadRequestException('You have no Avatar Refreshes remaining. Buy an Avatar Refresh pack to try another look.');
    }

    const output = await this.imageProvider.generateAvatar({
      name: 'character',
      photoBuffer: photo.buffer,
      photoMimeType: photo.mimetype,
      adjustmentHint: adjustmentHint?.trim() || undefined,
    });

    let avatarUrl: string;
    try {
      avatarUrl = await this.persist(userId, output, type);
    } catch (err) {
      this.logger.error(
        `Avatar persist failed for user ${userId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new BadRequestException('Avatar generation failed. Please try again.');
    }

    // Save record and increment counter only after successful upload
    await this.avatarRepo.save(
      this.avatarRepo.create({ userId, avatarUrl, type }),
    );

    if (type === 'hero') {
      await this.userRepo.increment({ id: userId }, 'heroAvatarGenerationsUsed', 1);
    } else {
      await this.consumeAvatarRefresh(userId);
      await this.userRepo.increment({ id: userId }, 'characterAvatarGenerationsUsed', 1);
    }

    return { avatarUrl };
  }

  private async persist(
    userId: string,
    output: ImageGenerationOutput,
    type: 'hero' | 'character',
  ): Promise<string> {
    if (output.imageBase64) {
      return type === 'hero'
        ? this.uploadService.uploadHeroAvatar(userId, output.imageBase64)
        : this.uploadService.uploadCharacterAvatar(userId, output.imageBase64);
    }

    // No base64 — fetch the temporary URL and re-upload so we have a permanent link
    if (output.imageUrl) {
      const res    = await fetch(output.imageUrl);
      const buf    = Buffer.from(await res.arrayBuffer());
      const base64 = buf.toString('base64');
      return type === 'hero'
        ? this.uploadService.uploadHeroAvatar(userId, base64)
        : this.uploadService.uploadCharacterAvatar(userId, base64);
    }

    throw new Error('No image data returned from AI provider');
  }

  private async consumeAvatarRefresh(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new BadRequestException('User not found');
      if (user.avatarRefreshTokens < 1) {
        throw new BadRequestException('You have no Avatar Refreshes remaining. Buy an Avatar Refresh pack to try another look.');
      }

      user.avatarRefreshTokens -= 1;
      await manager.save(user);
      await manager.save(
        manager.create(CreditTransaction, {
          userId,
          delta: 0,
          reason: CreditTransactionReason.AvatarRefreshUsed,
          referenceId: null,
          avatarRefreshTokensDelta: -1,
        }),
      );
    });
  }
}

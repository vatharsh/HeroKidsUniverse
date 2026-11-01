import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, In } from 'typeorm';

import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { Hero } from '../heroes/hero.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Story } from '../stories/story.entity';
import { User } from '../users/user.entity';
import { levelFor, POWER_LEVELS, POWER_SUGGESTIONS } from './special-powers.catalog';
import { PowerDrop, PowerFind } from './special-power.entities';

/** Today's date in India, YYYY-MM-DD. */
function istDay(offsetDays = 0): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Same story + same drop → same hiding spot, so the shimmer doesn't move around on reload. */
function hidingSpot(dropId: string, storyId: string, pageCount: number) {
  const h = createHash('sha256').update(`${dropId}:${storyId}`).digest();
  const firstStoryPage = pageCount > 1 ? 1 : 0; // never on the cover
  const pageIndex = firstStoryPage + (h[0] % Math.max(1, pageCount - firstStoryPage));
  return { pageIndex, x: 15 + (h[1] % 70), y: 25 + (h[2] % 55) };
}

@Injectable()
export class SpecialPowersService {
  constructor(private readonly dataSource: DataSource) {}

  private async today(): Promise<PowerDrop | null> {
    return this.dataSource.getRepository(PowerDrop).findOne({ where: { day: istDay(), isDeleted: false } });
  }

  private async heroCount(heroId: string): Promise<number> {
    return this.dataSource.getRepository(PowerFind).count({ where: { heroId } });
  }

  /** For the dashboard banner: is a power hiding today, and which of my heroes still need to find it. */
  async todayForUser(userId: string) {
    const drop = await this.today();
    const heroes = await this.dataSource.getRepository(Hero).find({ where: { userId }, select: { id: true, name: true } });
    const finds = drop && heroes.length
      ? await this.dataSource.getRepository(PowerFind).find({ where: { dropId: drop.id, heroId: In(heroes.map((h) => h.id)) } })
      : [];
    const counts = heroes.length
      ? await this.dataSource.query(
          `SELECT "heroId", COUNT(*)::int AS n FROM power_finds WHERE "heroId" = ANY($1) GROUP BY "heroId"`,
          [heroes.map((h) => h.id)],
        )
      : [];
    return {
      drop: drop ? { name: drop.name, emoji: drop.emoji } : null,
      heroes: heroes.map((h) => ({
        id: h.id,
        name: h.name,
        foundToday: finds.some((f) => f.heroId === h.id),
        ...levelFor(Number(counts.find((c: { heroId: string }) => c.heroId === h.id)?.n ?? 0)),
      })),
    };
  }

  /** Where today's power hides in this story (only the owner sees it). */
  async forStory(userId: string, storyId: string) {
    const drop = await this.today();
    if (!drop) return { active: false };
    const story = await this.dataSource.getRepository(Story).findOne({ where: { id: storyId, userId }, select: { id: true, heroId: true, pages: true, status: true } });
    if (!story || story.status !== 'completed' || !story.pages?.length) return { active: false };
    const found = await this.dataSource.getRepository(PowerFind).exist({ where: { dropId: drop.id, heroId: story.heroId } });
    return {
      active: true,
      drop: { id: drop.id, name: drop.name, emoji: drop.emoji, description: drop.description },
      found,
      ...hidingSpot(drop.id, story.id, story.pages.length),
      ...levelFor(await this.heroCount(story.heroId)),
    };
  }

  /** The hero grabbed today's power: record it, add it to their universe, hand out level rewards. */
  async claim(userId: string, storyId: string, dropId: string) {
    const drop = await this.today();
    if (!drop || drop.id !== dropId) throw new BadRequestException('This power has already vanished — look for the next one!');
    const story = await this.dataSource.getRepository(Story).findOne({ where: { id: storyId, userId }, select: { id: true, heroId: true, universeId: true } });
    if (!story) throw new NotFoundException('Story not found');

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new NotFoundException('User not found');
      if (await manager.exists(PowerFind, { where: { dropId: drop.id, heroId: story.heroId } })) {
        throw new ConflictException('Your hero already found today’s power!');
      }
      await manager.save(manager.create(PowerFind, { dropId: drop.id, heroId: story.heroId, userId, storyId: story.id }));

      // Add it to the hero's universe so the next episode can use it.
      const hero = await manager.findOne(Hero, { where: { id: story.heroId }, select: { id: true, name: true, universeId: true } });
      const universeId = story.universeId ?? hero?.universeId ?? null;
      if (universeId) {
        const exists = await manager.exists(HeroPower, { where: { universeId, name: drop.name } });
        if (!exists) {
          await manager.save(manager.create(HeroPower, {
            universeId,
            name: drop.name,
            emoji: drop.emoji,
            kind: 'power',
            description: `✨ Special power found on ${drop.day}: ${drop.description}`,
            look: null,
            earnedInStoryId: story.id,
          }));
        }
      }

      const count = await manager.count(PowerFind, { where: { heroId: story.heroId } });
      const progress = levelFor(count);
      let reward: string | null = null;
      const justReached = POWER_LEVELS.find((l) => l.at === count) ?? null;
      if (justReached && justReached.reward !== 'none') {
        const ref = `power-level:${story.heroId}:${justReached.at}`;
        if (!(await manager.exists(CreditTransaction, { where: { referenceId: ref } }))) {
          const credit = justReached.reward === 'story_credit' ? 1 : 0;
          const refresh = justReached.reward === 'avatar_refresh' ? 1 : 0;
          user.credits += credit;
          user.avatarRefreshTokens += refresh;
          await manager.save(user);
          await manager.save(manager.create(CreditTransaction, {
            userId,
            delta: credit,
            avatarRefreshTokensDelta: refresh,
            reason: CreditTransactionReason.Reward,
            referenceId: ref,
            packName: `${justReached.badge} ${justReached.name}`,
          }));
          reward = justReached.rewardText;
        }
      } else if (justReached) {
        reward = justReached.rewardText;
      }

      return {
        power: { name: drop.name, emoji: drop.emoji, description: drop.description },
        heroName: hero?.name ?? 'Your hero',
        addedToUniverse: !!universeId,
        newLevel: justReached ? { name: justReached.name, badge: justReached.badge } : null,
        reward,
        ...progress,
      };
    });
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  suggestions() {
    return POWER_SUGGESTIONS;
  }

  async adminList() {
    const drops = await this.dataSource.query(
      `SELECT d.id, d.day::text AS day, d.name, d.emoji, d.description,
              (SELECT COUNT(*) FROM power_finds f WHERE f."dropId" = d.id)::int AS finds
         FROM power_drops d WHERE d."isDeleted" = false AND d.day >= (CURRENT_DATE - 60) ORDER BY d.day DESC`,
    );
    const [totals] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS finds, COUNT(DISTINCT "heroId")::int AS heroes FROM power_finds`,
    );
    return { today: istDay(), drops, totals, levels: POWER_LEVELS };
  }

  async create(body: { day?: string; name?: string; emoji?: string; description?: string }) {
    const day = (body.day ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Pick a day');
    if (day < istDay()) throw new BadRequestException('That day has already passed');
    const name = (body.name ?? '').trim().slice(0, 60);
    const emoji = (body.emoji ?? '✨').trim().slice(0, 8) || '✨';
    const description = (body.description ?? '').trim().slice(0, 200);
    if (!name || !description) throw new BadRequestException('Give the power a name and a one-line description');
    const repo = this.dataSource.getRepository(PowerDrop);
    if (await repo.exists({ where: { day, isDeleted: false } })) throw new ConflictException('There is already a power on that day');
    return repo.save(repo.create({ day, name, emoji, description }));
  }

  async remove(id: string) {
    const repo = this.dataSource.getRepository(PowerDrop);
    const drop = await repo.findOne({ where: { id, isDeleted: false } });
    if (!drop) throw new NotFoundException('Not found');
    if (drop.day <= istDay() && (await this.dataSource.getRepository(PowerFind).exists({ where: { dropId: id } }))) {
      throw new ConflictException('Heroes have already found this power, so it can’t be removed');
    }
    drop.isDeleted = true;
    await repo.save(drop);
    return { ok: true };
  }

  /** Fills Mon / Wed / Sat for the next `weeks` weeks with powers not used before. */
  async planAhead(weeks = 2) {
    const repo = this.dataSource.getRepository(PowerDrop);
    const used = new Set((await repo.find({ where: { isDeleted: false }, select: { name: true } })).map((d) => d.name));
    const taken = new Set((await repo.find({ where: { isDeleted: false }, select: { day: true } })).map((d) => d.day));
    const pool = POWER_SUGGESTIONS.filter((p) => !used.has(p.name));
    const created: PowerDrop[] = [];
    for (let i = 1; i <= weeks * 7 && pool.length; i++) {
      const day = istDay(i);
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 1 Mon, 3 Wed, 6 Sat
      if (![1, 3, 6].includes(weekday) || taken.has(day)) continue;
      const pick = pool.shift()!;
      created.push(await repo.save(repo.create({ day, ...pick })));
    }
    return { created: created.length, ranOutOfIdeas: pool.length === 0 };
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';

import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { Hero } from '../heroes/hero.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Story } from '../stories/story.entity';
import { User } from '../users/user.entity';
import { COLLECTIONS, LIBRARY_BY_KEY, POWER_LEVELS, POWER_LIBRARY, progressFor } from './special-powers.catalog';
import { PowerDrop, PowerFind } from './special-power.entities';

/** India date, YYYY-MM-DD (offset in days from today). */
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

/** The live counter only shows once a day is busy enough to look exciting rather than empty. */
const COUNTER_FROM = 20;

@Injectable()
export class SpecialPowersService {
  constructor(private readonly dataSource: DataSource) {}

  private today(): Promise<PowerDrop | null> {
    return this.dataSource.getRepository(PowerDrop).findOne({ where: { day: istDay(), isDeleted: false } });
  }

  private async foundTodayCount(dropId: string): Promise<number | null> {
    const n = await this.dataSource.getRepository(PowerFind).count({ where: { dropId } });
    return n >= COUNTER_FROM ? n : null;
  }

  /** Library keys each hero has found. */
  private async foundKeys(heroIds: string[], manager: EntityManager = this.dataSource.manager): Promise<Map<string, string[]>> {
    const rows: Array<{ heroId: string; powerKey: string }> = heroIds.length
      ? await manager.query(
          `SELECT DISTINCT f."heroId", d."powerKey" FROM power_finds f JOIN power_drops d ON d.id = f."dropId"
            WHERE f."heroId" = ANY($1) AND d."powerKey" IS NOT NULL`,
          [heroIds],
        )
      : [];
    const map = new Map<string, string[]>(heroIds.map((id) => [id, []]));
    rows.forEach((r) => map.get(r.heroId)?.push(r.powerKey));
    return map;
  }

  private summary(keys: string[]) {
    const p = progressFor(keys);
    return { count: p.count, total: p.total, completeSets: p.completeSets, level: p.level, next: p.next, closest: p.closest };
  }

  /** Home page announcement (no login): just whether a power is hiding today and what it looks like. */
  async publicToday() {
    const drop = await this.today();
    return drop ? { name: drop.name, emoji: drop.emoji, foundToday: await this.foundTodayCount(drop.id) } : null;
  }

  /** Dashboard banner + hero frames: today's power and every hero's level. */
  async todayForUser(userId: string) {
    const drop = await this.today();
    const heroes = await this.dataSource.getRepository(Hero).find({ where: { userId }, select: { id: true, name: true } });
    const ids = heroes.map((h) => h.id);
    const finds = drop && ids.length ? await this.dataSource.getRepository(PowerFind).find({ where: { dropId: drop.id, heroId: In(ids) } }) : [];
    const keys = await this.foundKeys(ids);
    return {
      drop: drop ? { name: drop.name, emoji: drop.emoji, foundToday: await this.foundTodayCount(drop.id) } : null,
      heroes: heroes.map((h) => ({ id: h.id, name: h.name, foundToday: finds.some((f) => f.heroId === h.id), ...this.summary(keys.get(h.id) ?? []) })),
    };
  }

  /** The Power Book for one of my heroes: every collection with found / missing powers, plus Bonus finds. */
  async book(userId: string, heroId: string) {
    const hero = await this.dataSource.getRepository(Hero).findOne({ where: { id: heroId, userId }, select: { id: true, name: true } });
    if (!hero) throw new NotFoundException('Hero not found');
    const rows: Array<{ powerKey: string | null; name: string; emoji: string; description: string; foundAt: string }> = await this.dataSource.query(
      `SELECT d."powerKey", d.name, d.emoji, d.description, MIN(f."createdAt") AS "foundAt"
         FROM power_finds f JOIN power_drops d ON d.id = f."dropId"
        WHERE f."heroId" = $1 GROUP BY d."powerKey", d.name, d.emoji, d.description`,
      [heroId],
    );
    const foundAt = new Map(rows.filter((r) => r.powerKey).map((r) => [r.powerKey!, r.foundAt]));
    const progress = progressFor(foundAt.keys());
    return {
      hero: { id: hero.id, name: hero.name },
      ...this.summary([...foundAt.keys()]),
      levels: POWER_LEVELS,
      collections: progress.collections.map((c) => ({
        ...c,
        // Missing powers are shown as silhouettes — the name stays a surprise until found.
        powers: POWER_LIBRARY.filter((p) => p.collection === c.key).map((p) =>
          foundAt.has(p.key)
            ? { key: p.key, found: true, name: p.name, emoji: p.emoji, description: p.description, foundAt: foundAt.get(p.key) }
            : { key: p.key, found: false }),
      })),
      bonus: rows.filter((r) => !r.powerKey).map((r) => ({ name: r.name, emoji: r.emoji, description: r.description, foundAt: r.foundAt })),
    };
  }

  /** Where today's power hides in this story (only the owner sees it). */
  async forStory(userId: string, storyId: string) {
    const drop = await this.today();
    if (!drop) return { active: false };
    const story = await this.dataSource.getRepository(Story).findOne({ where: { id: storyId, userId }, select: { id: true, heroId: true, pages: true, status: true } });
    if (!story || story.status !== 'completed' || !story.pages?.length) return { active: false };
    const found = await this.dataSource.getRepository(PowerFind).exists({ where: { dropId: drop.id, heroId: story.heroId } });
    const keys = await this.foundKeys([story.heroId]);
    const collection = drop.powerKey ? COLLECTIONS.find((c) => c.key === LIBRARY_BY_KEY.get(drop.powerKey!)?.collection) ?? null : null;
    return {
      active: true,
      drop: { id: drop.id, name: drop.name, emoji: drop.emoji, description: drop.description, collection: collection ? { name: collection.name, emoji: collection.emoji } : null },
      found,
      foundToday: await this.foundTodayCount(drop.id),
      ...hidingSpot(drop.id, story.id, story.pages.length),
      ...this.summary(keys.get(story.heroId) ?? []),
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
      const before = progressFor((await this.foundKeys([story.heroId], manager)).get(story.heroId) ?? []);
      await manager.save(manager.create(PowerFind, { dropId: drop.id, heroId: story.heroId, userId, storyId: story.id }));
      const after = progressFor((await this.foundKeys([story.heroId], manager)).get(story.heroId) ?? []);

      // Add it to the hero's universe so the next episode can use it.
      const hero = await manager.findOne(Hero, { where: { id: story.heroId }, select: { id: true, name: true, universeId: true } });
      const universeId = story.universeId ?? hero?.universeId ?? null;
      if (universeId && !(await manager.exists(HeroPower, { where: { universeId, name: drop.name } }))) {
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

      // Levels reached by this find (usually none, at most one) — reward each once.
      const newLevels = POWER_LEVELS.filter((l) => before.completeSets < l.sets && after.completeSets >= l.sets);
      const rewards: string[] = [];
      for (const level of newLevels) {
        const ref = `power-level:${story.heroId}:${level.key}`;
        if (await manager.exists(CreditTransaction, { where: { referenceId: ref } })) continue;
        const credits = level.reward === 'story_credit' ? 1 : level.reward === 'two_story_credits' ? 2 : 0;
        const refreshes = level.reward === 'avatar_refresh' ? 1 : 0;
        if (credits || refreshes) {
          user.credits += credits;
          user.avatarRefreshTokens += refreshes;
          await manager.save(user);
        }
        await manager.save(manager.create(CreditTransaction, {
          userId, delta: credits, avatarRefreshTokensDelta: refreshes,
          reason: CreditTransactionReason.Reward, referenceId: ref, packName: `${level.badge} ${level.name}`,
        }));
        rewards.push(level.rewardText);
      }

      const justCompleted = drop.powerKey
        ? after.collections.find((c) => c.complete && !before.collections.find((b) => b.key === c.key)?.complete) ?? null
        : null;
      return {
        power: { name: drop.name, emoji: drop.emoji, description: drop.description },
        heroName: hero?.name ?? 'Your hero',
        isBonus: !drop.powerKey,
        addedToUniverse: !!universeId,
        completedCollection: justCompleted ? { name: justCompleted.name, emoji: justCompleted.emoji } : null,
        newLevel: newLevels.length ? { name: newLevels[newLevels.length - 1].name, badge: newLevels[newLevels.length - 1].badge } : null,
        reward: rewards.length ? rewards.join(' · ') : null,
        count: after.count,
        total: after.total,
        completeSets: after.completeSets,
        level: after.level,
        next: after.next,
        closest: after.closest,
      };
    });
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  library() {
    return { collections: COLLECTIONS, powers: POWER_LIBRARY };
  }

  async adminList() {
    const drops = await this.dataSource.query(
      `SELECT d.id, d.day::text AS day, d."powerKey", d.name, d.emoji, d.description,
              (SELECT COUNT(*) FROM power_finds f WHERE f."dropId" = d.id)::int AS finds
         FROM power_drops d WHERE d."isDeleted" = false AND d.day >= (CURRENT_DATE - 60) ORDER BY d.day DESC`,
    );
    const [totals] = await this.dataSource.query(`SELECT COUNT(*)::int AS finds, COUNT(DISTINCT "heroId")::int AS heroes FROM power_finds`);
    return { today: istDay(), drops, totals, levels: POWER_LEVELS, collections: COLLECTIONS };
  }

  async create(body: { day?: string; powerKey?: string | null; name?: string; emoji?: string; description?: string }) {
    const day = (body.day ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Pick a day');
    if (day < istDay()) throw new BadRequestException('That day has already passed');
    const lib = body.powerKey ? LIBRARY_BY_KEY.get(body.powerKey) : undefined;
    if (body.powerKey && !lib) throw new BadRequestException('Unknown power');
    const name = (lib?.name ?? body.name ?? '').trim().slice(0, 60);
    const emoji = (lib?.emoji ?? body.emoji ?? '✨').trim().slice(0, 8) || '✨';
    const description = (lib?.description ?? body.description ?? '').trim().slice(0, 200);
    if (!name || !description) throw new BadRequestException('Give the power a name and a one-line description');
    if (!lib && POWER_LIBRARY.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new BadRequestException('That name is a Power Book power — pick it from the list instead');
    }
    const repo = this.dataSource.getRepository(PowerDrop);
    if (await repo.exists({ where: { day, isDeleted: false } })) throw new ConflictException('There is already a power on that day');
    return repo.save(repo.create({ day, powerKey: lib?.key ?? null, name, emoji, description }));
  }

  async remove(id: string) {
    const repo = this.dataSource.getRepository(PowerDrop);
    const drop = await repo.findOne({ where: { id, isDeleted: false } });
    if (!drop) throw new NotFoundException('Not found');
    if (await this.dataSource.getRepository(PowerFind).exists({ where: { dropId: id } })) {
      throw new ConflictException('Heroes have already found this power, so it can’t be removed');
    }
    drop.isDeleted = true;
    await repo.save(drop);
    return { ok: true };
  }

  /**
   * Fills Mon / Wed / Sat for the next `weeks` weeks from the Power Book: least-dropped powers first,
   * taking turns between collections, so every collection keeps moving and missed powers come round again.
   */
  async planAhead(weeks = 2) {
    const repo = this.dataSource.getRepository(PowerDrop);
    const existing = await repo.find({ where: { isDeleted: false }, select: { day: true, powerKey: true } });
    const taken = new Set(existing.map((d) => d.day));
    const times = new Map<string, number>(POWER_LIBRARY.map((p) => [p.key, 0]));
    existing.forEach((d) => d.powerKey && times.set(d.powerKey, (times.get(d.powerKey) ?? 0) + 1));
    const lastSet = existing.filter((d) => d.powerKey).sort((a, b) => b.day.localeCompare(a.day))[0];
    let turn = Math.max(0, COLLECTIONS.findIndex((c) => c.key === LIBRARY_BY_KEY.get(lastSet?.powerKey ?? '')?.collection) + 1);

    let created = 0;
    for (let i = 1; i <= weeks * 7; i++) {
      const day = istDay(i);
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 1 Mon, 3 Wed, 6 Sat
      if (![1, 3, 6].includes(weekday) || taken.has(day)) continue;
      const collection = COLLECTIONS[turn % COLLECTIONS.length].key;
      turn++;
      const pick = POWER_LIBRARY.filter((p) => p.collection === collection)
        .sort((a, b) => (times.get(a.key)! - times.get(b.key)!) || POWER_LIBRARY.indexOf(a) - POWER_LIBRARY.indexOf(b))[0];
      times.set(pick.key, times.get(pick.key)! + 1);
      await repo.save(repo.create({ day, powerKey: pick.key, name: pick.name, emoji: pick.emoji, description: pick.description }));
      created++;
    }
    return { created };
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Quest, QuestStatus } from '../quests/quest.entity';
import { CreateUniverseDto } from './dto/create-universe.dto';
import { UpdateUniverseDto } from './dto/update-universe.dto';
import { UniverseMemory } from './universe-memory.entity';
import { Universe, UniverseVisualState } from './universe.entity';
import { ContentSafetyService } from '../ai/content-safety.service';
import { isSandboxFor } from '../common/sandbox';
import { Story, StoryStatus } from '../stories/story.entity';
import { pickThumbnail, type StoryImages } from './universe-thumbnails';

@Injectable()
export class UniversesService {
  constructor(
    @InjectRepository(Universe)
    private readonly universesRepository: Repository<Universe>,
    @InjectRepository(UniverseMemory)
    private readonly memoriesRepository: Repository<UniverseMemory>,
    @InjectRepository(HeroPower)
    private readonly powersRepository: Repository<HeroPower>,
    @InjectRepository(Quest)
    private readonly questsRepository: Repository<Quest>,
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
    private readonly safety: ContentSafetyService,
    @InjectRepository(Story)
    private readonly storiesRepository: Repository<Story>,
  ) {}

  async create(userId: string, dto: CreateUniverseDto): Promise<Universe> {
    await this.safety.assertSafeInput({ name: dto.name, heroTitle: dto.heroTitle, tagline: dto.tagline }, userId);
    const isSandbox = await isSandboxFor(this.settingsRepo.manager.connection, userId);
    return this.universesRepository.save(
      this.universesRepository.create({
        userId,
        name: dto.name,
        heroTitle: dto.heroTitle ?? null,
        tagline: dto.tagline ?? null,
        coverImageUrl: null,
        isSandbox,
      }),
    );
  }

  async findMine(userId: string): Promise<Universe[]> {
    const universes = await this.universesRepository.find({
      where: { userId },
      relations: { memories: true, quests: true, powers: true, arcs: true, villains: true },
      // One query per list, sorted here rather than in SQL: a single join multiplies the rows
      // (memories × quests × powers × villains) and sorting nested lists in the query made TypeORM
      // build a slow one — the universe page took 1–3 seconds once a universe had dozens of episodes.
      relationLoadStrategy: 'query',
      order: { createdAt: 'ASC' },
    });
    const newestFirst = <T>(items: T[] | undefined, key: (item: T) => Date) =>
      (items ?? []).sort((a, b) => key(b).getTime() - key(a).getTime());
    for (const universe of universes) {
      newestFirst(universe.memories, (m) => m.createdAt);
      newestFirst(universe.quests, (q) => q.createdAt);
      newestFirst(universe.powers, (p) => p.createdAt);
      newestFirst(universe.arcs, (a) => a.createdAt);
      newestFirst(universe.villains, (v) => v.updatedAt);
    }
    await this.attachThumbnails(userId, universes);
    return universes;
  }

  /** Adds thumbnailUrl/thumbnailStoryId to every villain, power, quest, memory and arc, from story art. */
  private async attachThumbnails(userId: string, universes: Universe[]): Promise<void> {
    if (!universes.length) return;
    const stories = await this.storiesRepository.find({
      where: { userId, universeId: In(universes.map((u) => u.id)), status: StoryStatus.Completed },
      select: { id: true, universeId: true, arcId: true, coverImageUrl: true, pages: true, createdAt: true },
      order: { createdAt: 'ASC' },
    });
    const byId = new Map<string, StoryImages>(stories.map((s) => [s.id, s]));
    const story = (id: string | null | undefined) => (id ? byId.get(id) : undefined);

    for (const universe of universes) {
      for (const v of universe.villains ?? []) {
        Object.assign(v, pickThumbnail(story(v.firstStoryId) ?? story(v.lastStoryId), { character: v.name, name: v.name }));
      }
      for (const p of universe.powers ?? []) {
        Object.assign(p, pickThumbnail(story(p.earnedInStoryId), { name: p.name, prefer: 'last' }));
      }
      for (const q of universe.quests ?? []) {
        const from = q.status === QuestStatus.Completed ? story(q.completedInStoryId) ?? story(q.openedInStoryId) : story(q.openedInStoryId);
        Object.assign(q, pickThumbnail(from, { name: q.title, prefer: 'last', fallback: 'lastPage' }));
      }
      for (const m of universe.memories ?? []) {
        Object.assign(m, pickThumbnail(story(m.storyId), { name: m.title, prefer: 'last' }));
      }
      for (const a of universe.arcs ?? []) {
        Object.assign(a, pickThumbnail(stories.find((s) => s.arcId === a.id)));
      }
    }
  }

  async update(userId: string, id: string, dto: UpdateUniverseDto): Promise<Universe> {
    await this.safety.assertSafeInput({ name: dto.name, heroTitle: dto.heroTitle, tagline: dto.tagline }, userId);
    const universe = await this.findOwnedUniverse(userId, id);

    Object.assign(universe, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.heroTitle !== undefined ? { heroTitle: dto.heroTitle } : {}),
      ...(dto.tagline !== undefined ? { tagline: dto.tagline } : {}),
    });

    return this.universesRepository.save(universe);
  }

  async updateVisualState(universeId: string, userId: string, patch: Partial<UniverseVisualState>) {
    const universe = await this.universesRepository.findOneOrFail({ where: { id: universeId, userId } });
    universe.visualState = { ...(universe.visualState ?? {}), ...patch } as UniverseVisualState;
    return this.universesRepository.save(universe);
  }

  async getTimeline(userId: string, id: string): Promise<UniverseMemory[]> {
    await this.findOwnedUniverse(userId, id);

    return this.memoriesRepository.find({
      where: { universeId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async getStats(userId: string): Promise<{
    episodeCount: number;
    powerCount: number;
    openQuestCount: number;
    memoryCount: number;
  }> {
    const universe = await this.universesRepository.findOne({ where: { userId } });

    if (!universe) {
      return { episodeCount: 0, powerCount: 0, openQuestCount: 0, memoryCount: 0 };
    }

    const [powerCount, openQuestCount, memoryCount] = await Promise.all([
      this.powersRepository.count({ where: { universeId: universe.id } }),
      this.questsRepository.count({
        where: { universeId: universe.id, status: QuestStatus.Open },
      }),
      this.memoriesRepository.count({ where: { universeId: universe.id } }),
    ]);

    return { episodeCount: 0, powerCount, openQuestCount, memoryCount };
  }

  async findOwnedUniverse(userId: string, id: string): Promise<Universe> {
    const universe = await this.universesRepository.findOne({ where: { id } });

    if (!universe) {
      throw new NotFoundException('Universe not found');
    }

    if (universe.userId !== userId) {
      throw new ForbiddenException('You do not own this universe');
    }

    return universe;
  }
}

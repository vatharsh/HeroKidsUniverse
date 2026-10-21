import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Quest, QuestStatus } from '../quests/quest.entity';
import { CreateUniverseDto } from './dto/create-universe.dto';
import { UpdateUniverseDto } from './dto/update-universe.dto';
import { UniverseMemory } from './universe-memory.entity';
import { Universe, UniverseVisualState } from './universe.entity';
import { ContentSafetyService } from '../ai/content-safety.service';
import { isSandboxFor } from '../common/sandbox';

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
    return this.universesRepository.find({
      where: { userId },
      relations: { memories: true, quests: true, powers: true, arcs: true, villains: true },
      order: {
        createdAt: 'ASC',
        memories: { createdAt: 'DESC' },
        quests: { createdAt: 'DESC' },
        powers: { createdAt: 'DESC' },
        arcs: { createdAt: 'DESC' },
        villains: { updatedAt: 'DESC' },
      },
    });
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

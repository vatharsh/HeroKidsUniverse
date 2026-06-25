import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { HeroPower } from '../powers/hero-power.entity';
import { Quest, QuestStatus } from '../quests/quest.entity';
import { CreateUniverseDto } from './dto/create-universe.dto';
import { UpdateUniverseDto } from './dto/update-universe.dto';
import { UniverseMemory } from './universe-memory.entity';
import { Universe } from './universe.entity';

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
  ) {}

  async create(userId: string, dto: CreateUniverseDto): Promise<Universe> {
    return this.universesRepository.save(
      this.universesRepository.create({
        userId,
        name: dto.name,
        heroTitle: dto.heroTitle ?? null,
        tagline: dto.tagline ?? null,
        coverImageUrl: null,
      }),
    );
  }

  async findMine(userId: string): Promise<Universe[]> {
    return this.universesRepository.find({
      where: { userId },
      relations: { memories: true, quests: true, powers: true, arcs: true },
      order: {
        createdAt: 'ASC',
        memories: { createdAt: 'DESC' },
        quests: { createdAt: 'DESC' },
        powers: { createdAt: 'DESC' },
        arcs: { createdAt: 'DESC' },
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateUniverseDto): Promise<Universe> {
    const universe = await this.findOwnedUniverse(userId, id);

    Object.assign(universe, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.heroTitle !== undefined ? { heroTitle: dto.heroTitle } : {}),
      ...(dto.tagline !== undefined ? { tagline: dto.tagline } : {}),
    });

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

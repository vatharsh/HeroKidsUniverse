import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Universe } from '../universes/universe.entity';
import { CreateStoryArcDto } from './dto/create-story-arc.dto';
import { ArcStatus, StoryArc } from './story-arc.entity';

@Injectable()
export class StoryArcsService {
  constructor(
    @InjectRepository(StoryArc)
    private readonly arcsRepository: Repository<StoryArc>,
    @InjectRepository(Universe)
    private readonly universesRepository: Repository<Universe>,
  ) {}

  async list(userId: string, universeId: string): Promise<StoryArc[]> {
    await this.assertUniverseOwner(userId, universeId);

    return this.arcsRepository.find({
      where: { universeId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateStoryArcDto): Promise<StoryArc> {
    await this.assertUniverseOwner(userId, dto.universeId);

    return this.arcsRepository.save(
      this.arcsRepository.create({
        universeId: dto.universeId,
        title: dto.title,
        summary: dto.summary ?? null,
      }),
    );
  }

  async complete(userId: string, id: string): Promise<StoryArc> {
    const arc = await this.arcsRepository.findOne({ where: { id } });

    if (!arc) {
      throw new NotFoundException('Story arc not found');
    }

    await this.assertUniverseOwner(userId, arc.universeId);
    arc.status = ArcStatus.Completed;
    return this.arcsRepository.save(arc);
  }

  private async assertUniverseOwner(userId: string, universeId: string): Promise<Universe> {
    const universe = await this.universesRepository.findOne({ where: { id: universeId } });

    if (!universe) {
      throw new NotFoundException('Universe not found');
    }

    if (universe.userId !== userId) {
      throw new ForbiddenException('You do not own this universe');
    }

    return universe;
  }
}

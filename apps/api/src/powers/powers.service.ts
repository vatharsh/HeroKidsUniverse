import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Universe } from '../universes/universe.entity';
import { CreateHeroPowerDto } from './dto/create-hero-power.dto';
import { HeroPower } from './hero-power.entity';

@Injectable()
export class PowersService {
  constructor(
    @InjectRepository(HeroPower)
    private readonly powersRepository: Repository<HeroPower>,
    @InjectRepository(Universe)
    private readonly universesRepository: Repository<Universe>,
  ) {}

  async list(userId: string, universeId: string): Promise<HeroPower[]> {
    await this.assertUniverseOwner(userId, universeId);

    return this.powersRepository.find({
      where: { universeId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateHeroPowerDto): Promise<HeroPower> {
    await this.assertUniverseOwner(userId, dto.universeId);

    return this.powersRepository.save(
      this.powersRepository.create({
        universeId: dto.universeId,
        name: dto.name,
        description: dto.description ?? null,
        emoji: dto.emoji ?? null,
        earnedInStoryId: null,
      }),
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    const power = await this.powersRepository.findOne({ where: { id } });

    if (!power) {
      throw new NotFoundException('Power not found');
    }

    await this.assertUniverseOwner(userId, power.universeId);
    await this.powersRepository.remove(power);
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

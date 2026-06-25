import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Universe } from '../universes/universe.entity';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { UniverseCompanion } from './entities/universe-companion.entity';

@Injectable()
export class CompanionsService {
  constructor(
    @InjectRepository(UniverseCompanion)
    private readonly companionsRepository: Repository<UniverseCompanion>,
    @InjectRepository(Universe)
    private readonly universesRepository: Repository<Universe>,
  ) {}

  getByUniverse(universeId: string): Promise<UniverseCompanion | null> {
    return this.companionsRepository.findOne({
      where: { universeId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createOrReplace(
    userId: string,
    universeId: string,
    dto: CreateCompanionDto,
  ): Promise<UniverseCompanion> {
    const universe = await this.universesRepository.findOne({ where: { id: universeId } });
    if (!universe) throw new NotFoundException('Universe not found');
    if (universe.userId !== userId) throw new ForbiddenException('You do not own this universe');

    await this.companionsRepository.update({ universeId, isActive: true }, { isActive: false });

    const companion = this.companionsRepository.create({
      universeId,
      petCharacterId: dto.petCharacterId,
      type: dto.type,
      name: dto.name,
      description: dto.description,
      avatarUrl: dto.avatarUrl,
      isActive: true,
    });

    return this.companionsRepository.save(companion);
  }

  async remove(userId: string, companionId: string): Promise<void> {
    const companion = await this.companionsRepository.findOne({ where: { id: companionId } });
    if (!companion) throw new NotFoundException('Companion not found');

    const universe = await this.universesRepository.findOne({ where: { id: companion.universeId } });
    if (!universe) throw new NotFoundException('Universe not found');
    if (universe.userId !== userId) throw new ForbiddenException('You do not own this companion');

    companion.isActive = false;
    await this.companionsRepository.save(companion);
  }
}

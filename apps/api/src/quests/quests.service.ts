import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Universe } from '../universes/universe.entity';
import { CreateQuestDto } from './dto/create-quest.dto';
import { Quest, QuestStatus } from './quest.entity';

@Injectable()
export class QuestsService {
  constructor(
    @InjectRepository(Quest)
    private readonly questsRepository: Repository<Quest>,
    @InjectRepository(Universe)
    private readonly universesRepository: Repository<Universe>,
  ) {}

  async list(userId: string, universeId: string): Promise<Quest[]> {
    await this.assertUniverseOwner(userId, universeId);

    return this.questsRepository.find({
      where: { universeId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateQuestDto): Promise<Quest> {
    await this.assertUniverseOwner(userId, dto.universeId);

    return this.questsRepository.save(
      this.questsRepository.create({
        universeId: dto.universeId,
        title: dto.title,
        description: dto.description ?? null,
        openedInStoryId: null,
        completedInStoryId: null,
      }),
    );
  }

  async complete(userId: string, id: string): Promise<Quest> {
    const quest = await this.findOwnedQuest(userId, id);
    quest.status = QuestStatus.Completed;
    return this.questsRepository.save(quest);
  }

  async remove(userId: string, id: string): Promise<void> {
    const quest = await this.findOwnedQuest(userId, id);
    await this.questsRepository.remove(quest);
  }

  private async findOwnedQuest(userId: string, id: string): Promise<Quest> {
    const quest = await this.questsRepository.findOne({ where: { id } });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    await this.assertUniverseOwner(userId, quest.universeId);
    return quest;
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

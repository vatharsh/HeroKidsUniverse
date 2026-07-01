import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { IMAGE_GENERATION_PROVIDER } from '../ai/interfaces/image-generation.provider';
import type { ImageGenerationProvider } from '../ai/interfaces/image-generation.provider';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { UploadService } from '../upload/upload.service';
import { User, UserPlan } from '../users/user.entity';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { Character } from './entities/character.entity';

@Injectable()
export class CharactersService {
  private readonly logger = new Logger(CharactersService.name);

  constructor(
    @InjectRepository(Character)
    private readonly charactersRepository: Repository<Character>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(CreditTransaction)
    private readonly transactionsRepository: Repository<CreditTransaction>,
    private readonly dataSource: DataSource,
    private readonly uploadService: UploadService,
    @Inject(IMAGE_GENERATION_PROVIDER)
    private readonly imageProvider: ImageGenerationProvider,
  ) {}

  async create(
    userId: string,
    createCharacterDto: CreateCharacterDto,
    photo?: Express.Multer.File,
  ): Promise<Character> {
    let character = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');
      if (!this.hasAvailableCharacterSlot(user)) {
        throw new BadRequestException('You have used all character slots. Buy more character slots to add another family member.');
      }

      user.characterSlotsUsed += 1;
      await manager.save(user);

      const saved = await manager.save(
        manager.create(Character, {
          userId,
          universeId: null,
          name: createCharacterDto.name,
          role: createCharacterDto.role ?? 'other',
          dob: createCharacterDto.dob ?? null,
          photoUrl: null,
          avatarUrl: createCharacterDto.avatarUrl ?? null,
          avatarDescription: null,
        }),
      );

      await manager.save(
        manager.create(CreditTransaction, {
          userId,
          delta: 0,
          reason: CreditTransactionReason.CharacterSlotUsed,
          referenceId: saved.id,
          characterSlotsDelta: -1,
        }),
      );

      return saved;
    });

    if (photo) {
      character.photoUrl = await this.uploadService.uploadCharacterPhoto(userId, photo);
      const result = await this.generateAvatar(userId, createCharacterDto.name, createCharacterDto.role, photo);
      character.avatarUrl = result.avatarUrl;
      character.avatarDescription = result.avatarDescription;
      character = await this.charactersRepository.save(character);
    }

    return character;
  }

  async getCharacterEconomy(userId: string) {
    const user = await this.usersRepository.findOneOrFail({ where: { id: userId } });
    return this.serializeEconomy(user);
  }

  findAll(userId: string): Promise<Character[]> {
    return this.charactersRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Character> {
    const character = await this.charactersRepository.findOne({ where: { id, userId } });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    return character;
  }

  async findByIds(userId: string, ids: string[]): Promise<Character[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.charactersRepository.find({
      where: { id: In(ids), userId },
    });
  }

  async update(
    userId: string,
    id: string,
    updateCharacterDto: UpdateCharacterDto,
    photo?: Express.Multer.File,
  ): Promise<Character> {
    const character = await this.findOne(userId, id);

    Object.assign(character, {
      ...updateCharacterDto,
      role: updateCharacterDto.role ?? character.role,
      dob: updateCharacterDto.dob ?? character.dob,
    });

    if (photo) {
      await this.consumeAvatarRefresh(userId, character.id);
      character.photoUrl = await this.uploadService.uploadCharacterPhoto(userId, photo);
      const result = await this.generateAvatar(userId, character.name, character.role, photo);
      character.avatarUrl = result.avatarUrl;
      character.avatarDescription = result.avatarDescription;
    } else if (updateCharacterDto.avatarUrl !== undefined) {
      character.avatarUrl = updateCharacterDto.avatarUrl;
    }

    return this.charactersRepository.save(character);
  }

  async refreshAvatar(
    userId: string,
    id: string,
    photo: Express.Multer.File,
    adjustmentHint?: string,
  ): Promise<{ avatarUrl: string; avatarRefreshTokens: number }> {
    if (!photo) throw new BadRequestException('Photo is required');
    const character = await this.findOne(userId, id);

    const avatarRefreshTokens = await this.consumeAvatarRefresh(userId, character.id);
    character.photoUrl = await this.uploadService.uploadCharacterPhoto(userId, photo);
    const result = await this.generateAvatar(userId, character.name, character.role, photo, adjustmentHint);
    character.avatarUrl = result.avatarUrl;
    character.avatarDescription = result.avatarDescription;
    if (!character.avatarUrl) throw new BadRequestException('Avatar refresh failed. Please try again.');
    await this.charactersRepository.save(character);

    return { avatarUrl: character.avatarUrl, avatarRefreshTokens };
  }

  async remove(userId: string, id: string): Promise<void> {
    const character = await this.findOne(userId, id);
    await this.charactersRepository.remove(character);
  }

  private async generateAvatar(
    userId: string,
    name: string,
    role: string | undefined,
    photo: Express.Multer.File,
    adjustmentHint?: string,
  ): Promise<{ avatarUrl: string | null; avatarDescription: string | null }> {
    try {
      const [avatar, avatarDescription] = await Promise.all([
        this.imageProvider.generateAvatar({
          name,
          role,
          photoBuffer: photo.buffer,
          photoMimeType: photo.mimetype,
          adjustmentHint: adjustmentHint?.trim() || undefined,
        }),
        this.imageProvider.describeCharacterAppearance(photo.buffer, photo.mimetype),
      ]);

      let avatarUrl: string | null = null;
      if (avatar.imageBase64) {
        avatarUrl = await this.uploadService.uploadCharacterAvatar(userId, avatar.imageBase64);
      } else {
        avatarUrl = avatar.imageUrl || null;
      }

      return { avatarUrl, avatarDescription };
    } catch (err) {
      this.logger.warn(
        `Avatar generation failed for character ${name}: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
      return { avatarUrl: null, avatarDescription: null };
    }
  }

  private hasAvailableCharacterSlot(user: User): boolean {
    return user.plan === UserPlan.Premium || user.characterSlotsTotal < 0 || user.characterSlotsUsed < user.characterSlotsTotal;
  }

  private async consumeAvatarRefresh(userId: string, characterId: string): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');
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
          referenceId: characterId,
          avatarRefreshTokensDelta: -1,
        }),
      );

      return user.avatarRefreshTokens;
    });
  }

  private serializeEconomy(user: User) {
    const unlimitedCharacters = user.plan === UserPlan.Premium || user.characterSlotsTotal < 0;
    return {
      characterSlotsTotal: user.characterSlotsTotal,
      characterSlotsUsed: user.characterSlotsUsed,
      characterSlotsRemaining: unlimitedCharacters
        ? null
        : Math.max(0, user.characterSlotsTotal - user.characterSlotsUsed),
      unlimitedCharacters,
      avatarRefreshTokens: user.avatarRefreshTokens,
    };
  }
}

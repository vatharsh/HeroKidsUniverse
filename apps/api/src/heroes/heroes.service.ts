import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IMAGE_GENERATION_PROVIDER } from '../ai/interfaces/image-generation.provider';
import type { ImageGenerationProvider } from '../ai/interfaces/image-generation.provider';
import { Story } from '../stories/story.entity';
import { UploadService } from '../upload/upload.service';
import { CreateHeroDto } from './dto/create-hero.dto';
import { UpdateHeroDto } from './dto/update-hero.dto';
import { Hero } from './hero.entity';

type HeroResponse = Hero & { age: number };

@Injectable()
export class HeroesService {
  private readonly logger = new Logger(HeroesService.name);

  constructor(
    @InjectRepository(Hero)
    private readonly heroesRepository: Repository<Hero>,
    @InjectRepository(Story)
    private readonly storiesRepository: Repository<Story>,
    private readonly uploadService: UploadService,
    @Inject(IMAGE_GENERATION_PROVIDER)
    private readonly imageProvider: ImageGenerationProvider,
  ) {}

  async create(
    userId: string,
    createHeroDto: CreateHeroDto,
    photo?: Express.Multer.File,
  ): Promise<HeroResponse> {
    let avatarUrl = createHeroDto.avatarUrl ?? null;

    let avatarDescription: string | null = null;
    let characterIdentity: Hero['characterIdentity'] = null;
    if (photo) {
      await this.uploadService.uploadHeroPhoto(userId, photo);
      const result = await this.generateAvatar(userId, createHeroDto.name, photo);
      avatarUrl = result.avatarUrl;
      avatarDescription = result.avatarDescription;
      characterIdentity = result.characterIdentity;
    }

    const hero = this.heroesRepository.create({
      ...createHeroDto,
      avatarUrl,
      avatarDescription,
      characterIdentity,
      userId,
    });
    return this.withComputedAge(await this.heroesRepository.save(hero));
  }

  async findAll(userId: string): Promise<HeroResponse[]> {
    const heroes = await this.heroesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return heroes.map((hero) => this.withComputedAge(hero));
  }

  async findOne(userId: string, id: string): Promise<HeroResponse> {
    const hero = await this.heroesRepository.findOne({ where: { id, userId } });

    if (!hero) {
      throw new NotFoundException('Hero not found');
    }

    return this.withComputedAge(hero);
  }

  async update(
    userId: string,
    id: string,
    updateHeroDto: UpdateHeroDto,
    photo?: Express.Multer.File,
  ): Promise<HeroResponse> {
    const hero = await this.findHeroEntity(userId, id);
    Object.assign(hero, {
      ...updateHeroDto,
      name: updateHeroDto.name ?? hero.name,
      dob: updateHeroDto.dob ?? hero.dob,
      gender: updateHeroDto.gender ?? hero.gender,
    });

    if (photo) {
      await this.uploadService.uploadHeroPhoto(userId, photo);
      const result = await this.generateAvatar(userId, hero.name ?? 'Hero', photo);
      hero.avatarUrl = result.avatarUrl;
      hero.avatarDescription = result.avatarDescription;
      hero.characterIdentity = result.characterIdentity;
    } else if (updateHeroDto.avatarUrl !== undefined) {
      hero.avatarUrl = updateHeroDto.avatarUrl;
    }

    return this.withComputedAge(await this.heroesRepository.save(hero));
  }

  async remove(userId: string, id: string): Promise<void> {
    const hero = await this.findHeroEntity(userId, id);
    const associatedStory = await this.storiesRepository.findOne({
      where: { heroId: id, userId },
      select: { id: true },
    });

    if (associatedStory) {
      throw new ConflictException('Hero has associated stories');
    }

    await this.heroesRepository.remove(hero);
  }

  private async findHeroEntity(userId: string, id: string): Promise<Hero> {
    const hero = await this.heroesRepository.findOne({ where: { id, userId } });

    if (!hero) {
      throw new NotFoundException('Hero not found');
    }

    return hero;
  }

  private withComputedAge(hero: Hero): HeroResponse {
    return Object.assign(hero, { age: this.computeAge(hero.dob) });
  }

  private computeAge(dob: string): number {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const beforeBirthday =
      today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());

    if (beforeBirthday) {
      age -= 1;
    }

    return age;
  }

  private async generateAvatar(
    userId: string,
    name: string,
    photo: Express.Multer.File,
  ): Promise<{ avatarUrl: string | null; avatarDescription: string | null; characterIdentity: Hero['characterIdentity'] }> {
    try {
      // Run avatar generation and appearance description in parallel
      const [avatar, avatarDescription] = await Promise.all([
        this.imageProvider.generateAvatar({
          name,
          role: 'hero',
          photoBuffer: photo.buffer,
          photoMimeType: photo.mimetype,
        }),
        this.imageProvider.describeCharacterAppearance(photo.buffer, photo.mimetype),
      ]);

      let avatarUrl: string | null = null;
      if (avatar.imageBase64) {
        avatarUrl = await this.uploadService.uploadHeroAvatar(userId, avatar.imageBase64);
      } else {
        avatarUrl = avatar.imageUrl || null;
      }

      const characterIdentity = avatarDescription
        ? await this.imageProvider.extractStructuredIdentity(avatarDescription)
        : null;

      return { avatarUrl, avatarDescription, characterIdentity };
    } catch (err) {
      this.logger.warn(
        `Avatar generation failed for hero ${name}: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
      return { avatarUrl: null, avatarDescription: null, characterIdentity: null };
    }
  }
}

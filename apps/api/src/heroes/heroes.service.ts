import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { IMAGE_GENERATION_PROVIDER } from '../ai/interfaces/image-generation.provider';
import type { ImageGenerationProvider } from '../ai/interfaces/image-generation.provider';
import { logAvatarUsage, releaseAvatarGeneration, reserveAvatarGeneration } from '../avatars/avatar-allowance';
import { Story } from '../stories/story.entity';
import { UploadService } from '../upload/upload.service';
import { CreateHeroDto } from './dto/create-hero.dto';
import { UpdateHeroDto } from './dto/update-hero.dto';
import { Hero } from './hero.entity';
import { ContentSafetyService } from '../ai/content-safety.service';

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
    private readonly dataSource: DataSource,
    private readonly safety: ContentSafetyService,
  ) {}

  async create(
    userId: string,
    createHeroDto: CreateHeroDto,
    photo?: Express.Multer.File,
  ): Promise<HeroResponse> {
    await this.safety.assertSafeInput({ name: createHeroDto.name }, userId);
    if (createHeroDto.avatarUrl && !this.uploadService.isOwnAssetUrl(createHeroDto.avatarUrl)) {
      throw new BadRequestException('Avatar must be an image created in HeroKids Universe.');
    }
    let avatarUrl = createHeroDto.avatarUrl ?? null;

    let avatarDescription: string | null = null;
    let characterIdentity: Hero['characterIdentity'] = null;
    if (photo) {
      // The raw photo is never uploaded/persisted — only used in-memory to generate the avatar.
      // heroId not available yet (entity not saved), so upload uses a random UUID prefix.
      const result = await this.generateChargedAvatar(userId, createHeroDto.name, photo);
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
    await this.safety.assertSafeInput({ name: updateHeroDto.name, costumeDescription: updateHeroDto.costumeDescription }, userId);
    if (updateHeroDto.avatarUrl && !this.uploadService.isOwnAssetUrl(updateHeroDto.avatarUrl)) {
      throw new BadRequestException('Avatar must be an image created in HeroKids Universe.');
    }
    const hero = await this.findHeroEntity(userId, id);
    const oldAvatarUrl = hero.avatarUrl;

    Object.assign(hero, {
      ...updateHeroDto,
      name: updateHeroDto.name ?? hero.name,
      dob: updateHeroDto.dob ?? hero.dob,
      gender: updateHeroDto.gender ?? hero.gender,
    });

    if (photo) {
      // The raw photo is never uploaded/persisted — only used in-memory to generate the avatar.
      const result = await this.generateChargedAvatar(userId, hero.name ?? 'Hero', photo, hero.id);
      hero.avatarUrl = result.avatarUrl;
      hero.avatarDescription = result.avatarDescription;
      hero.characterIdentity = result.characterIdentity;
    } else if (updateHeroDto.avatarUrl !== undefined) {
      hero.avatarUrl = updateHeroDto.avatarUrl;
    }

    const saved = await this.heroesRepository.save(hero);

    // Delete the old R2 object only after the DB is updated successfully
    if (photo && oldAvatarUrl && oldAvatarUrl !== saved.avatarUrl) {
      await this.uploadService.deleteObject(oldAvatarUrl);
    }

    return this.withComputedAge(saved);
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

    const avatarUrl = hero.avatarUrl;
    await this.heroesRepository.remove(hero);
    await this.uploadService.deleteObject(avatarUrl);
  }

  async adminRegenerateAvatar(heroId: string): Promise<HeroResponse> {
    const hero = await this.heroesRepository.findOne({ where: { id: heroId } });
    if (!hero) throw new NotFoundException('Hero not found');
    if (!hero.avatarUrl) throw new NotFoundException('Hero has no avatar to regenerate from');

    const oldAvatarUrl = hero.avatarUrl;

    let photoBuffer: Buffer | null = null;
    try {
      const res = await fetch(hero.avatarUrl);
      if (res.ok) photoBuffer = Buffer.from(await res.arrayBuffer());
    } catch {
      // fall through — generate without photo reference
    }

    const mockPhoto = photoBuffer
      ? { buffer: photoBuffer, mimetype: 'image/png', originalname: 'avatar.png' } as Express.Multer.File
      : null;

    if (mockPhoto) {
      const result = await this.generateAvatar(hero.userId, hero.name ?? 'Hero', mockPhoto, hero.id);
      hero.avatarUrl = result.avatarUrl ?? hero.avatarUrl;
      hero.avatarDescription = result.avatarDescription ?? hero.avatarDescription;
      hero.characterIdentity = result.characterIdentity ?? hero.characterIdentity;
    } else {
      const avatar = await this.imageProvider.generateAvatar({ name: hero.name ?? 'Hero', role: 'hero' });
      if (avatar.imageBase64) {
        hero.avatarUrl = await this.uploadService.uploadHeroAvatar(hero.userId, avatar.imageBase64, hero.id);
      }
    }

    this.logger.log(`Admin avatar regeneration for hero ${heroId} complete`);
    const saved = await this.heroesRepository.save(hero);

    if (oldAvatarUrl && oldAvatarUrl !== saved.avatarUrl) {
      await this.uploadService.deleteObject(oldAvatarUrl);
    }

    return this.withComputedAge(saved);
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

  /**
   * A parent's hero avatar uses the account's free allowance, then Avatar Refreshes — the same
   * rules as the avatar studio. Creating or editing heroes used to generate avatars with no limit.
   */
  private async generateChargedAvatar(userId: string, name: string, photo: Express.Multer.File, heroId?: string) {
    await this.safety.assertSafePhoto(photo, userId);
    const reservation = await reserveAvatarGeneration(this.dataSource, userId, 'hero', { referenceId: heroId ?? null });
    const result = await this.generateAvatar(userId, name, photo, heroId);
    if (!result.avatarUrl) await releaseAvatarGeneration(this.dataSource, reservation);
    else await logAvatarUsage(this.dataSource, userId);
    return result;
  }

  private async generateAvatar(
    userId: string,
    name: string,
    photo: Express.Multer.File,
    heroId?: string,
  ): Promise<{ avatarUrl: string | null; avatarDescription: string | null; characterIdentity: Hero['characterIdentity'] }> {
    try {
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
        avatarUrl = await this.uploadService.uploadHeroAvatar(userId, avatar.imageBase64, heroId);
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

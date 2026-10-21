import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import {
  IMAGE_GENERATION_PROVIDER,
} from '../ai/interfaces/image-generation.provider';
import type {
  ImageGenerationOutput,
  ImageGenerationProvider,
} from '../ai/interfaces/image-generation.provider';
import { UploadService } from '../upload/upload.service';
import { User } from '../users/user.entity';
import { UserAvatar } from './entities/user-avatar.entity';
import { logAvatarUsage, releaseAvatarGeneration, reserveAvatarGeneration } from './avatar-allowance';
import { ContentSafetyService } from '../ai/content-safety.service';

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);

  constructor(
    @InjectRepository(UserAvatar)
    private readonly avatarRepo: Repository<UserAvatar>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(IMAGE_GENERATION_PROVIDER)
    private readonly imageProvider: ImageGenerationProvider,
    private readonly uploadService: UploadService,
    private readonly safety: ContentSafetyService,
  ) {}

  async getStats(userId: string) {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const avatars = await this.avatarRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return {
      customAvatars:            avatars.map((a) => a.avatarUrl),
      heroGenerationsUsed:      user.heroAvatarGenerationsUsed,
      heroGenerationsMax:       await this.freeHeroAvatarLimit(),
      avatarRefreshTokens:      user.avatarRefreshTokens,
      characterGenerationsUsed: user.characterAvatarGenerationsUsed,
      characterGenerationsMax:  user.avatarRefreshTokens,
    };
  }

  async generate(
    userId: string,
    photo: Express.Multer.File,
    type: 'hero' | 'character',
    adjustmentHint?: string,
  ): Promise<{ avatarUrl: string }> {
    // Checked before anything is charged, so a rejected photo or instruction costs nothing.
    await this.safety.assertSafeInput({ adjustmentHint }, userId);
    await this.safety.assertSafePhoto(photo, userId);

    // Paid for up front (free allowance or a refresh) and refunded if anything fails.
    const reservation = await reserveAvatarGeneration(this.dataSource, userId, type);

    let avatarUrl: string;
    try {
      const output = await this.imageProvider.generateAvatar({
        name: 'character',
        photoBuffer: photo.buffer,
        photoMimeType: photo.mimetype,
        adjustmentHint: adjustmentHint?.trim() || undefined,
      });
      avatarUrl = await this.persist(userId, output, type);
    } catch (err) {
      await releaseAvatarGeneration(this.dataSource, reservation);
      this.logger.error(
        `Avatar generation failed for user ${userId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new BadRequestException('Avatar generation failed — you were not charged. Please try again.');
    }

    await logAvatarUsage(this.dataSource, userId);
    await this.avatarRepo.save(
      this.avatarRepo.create({ userId, avatarUrl, type }),
    );

    return { avatarUrl };
  }

  private async persist(
    userId: string,
    output: ImageGenerationOutput,
    type: 'hero' | 'character',
  ): Promise<string> {
    if (output.imageBase64) {
      return type === 'hero'
        ? this.uploadService.uploadHeroAvatar(userId, output.imageBase64)
        : this.uploadService.uploadCharacterAvatar(userId, output.imageBase64);
    }

    // No base64 — fetch the temporary URL and re-upload so we have a permanent link
    if (output.imageUrl) {
      const res    = await fetch(output.imageUrl);
      const buf    = Buffer.from(await res.arrayBuffer());
      const base64 = buf.toString('base64');
      return type === 'hero'
        ? this.uploadService.uploadHeroAvatar(userId, base64)
        : this.uploadService.uploadCharacterAvatar(userId, base64);
    }

    throw new Error('No image data returned from AI provider');
  }

  private async freeHeroAvatarLimit(): Promise<number> {
    const row = await this.dataSource.getRepository(PlatformSetting).findOne({ where: { key: 'FREE_HERO_AVATAR_GENERATIONS' } });
    return Number(row?.value ?? SETTING_DEFAULTS.FREE_HERO_AVATAR_GENERATIONS.value);
  }
}

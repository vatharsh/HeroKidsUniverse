import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting } from '../../admin/platform-setting.entity';
import type {
  ApparentAgeCheckInput,
  ApparentAgeCheckResult,
  AvatarGenerationInput,
  CostumedCanonicalInput,
  FaceConsistencyResult,
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageGenerationProvider,
  SpeechBubbleLayoutInput,
  SpeechBubbleLayoutResult,
} from '../interfaces/image-generation.provider';
import type { CharacterIdentity } from '../../heroes/hero.entity';
import { NanoBananaImageProvider } from './nano-banana-image.provider';
import { OpenAIImageProvider } from './openai-image.provider';

/**
 * Runtime dispatcher for image generation backends.
 *
 * Reads IMAGE_GENERATION_BACKEND from platform_settings on every call
 * (with a 30-second TTL cache) so the backend can be switched from the
 * admin panel without a redeploy.
 *
 * This solves the NestJS DI bootstrap-time resolution bug: a factory
 * provider would resolve the setting once at startup; this dispatcher
 * re-reads it on every request with a cache to avoid DB pressure.
 */
@Injectable()
export class ImageProviderDispatcher implements ImageGenerationProvider {
  private readonly logger = new Logger(ImageProviderDispatcher.name);
  private cachedBackend: string | null = null;
  private cacheExpiresAt = 0;
  private cachedAvatarBackend: string | null = null;
  private avatarCacheExpiresAt = 0;
  private static readonly CACHE_TTL_MS = 30_000;

  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
    private readonly openai: OpenAIImageProvider,
    private readonly nanoBanana: NanoBananaImageProvider,
  ) {}

  /** Returns which model name to log for usage tracking. */
  static modelNameForBackend(backend: string): string {
    return backend === 'gemini' ? NanoBananaImageProvider.IMAGE_MODEL : 'gpt-image-1';
  }

  /** Returns which provider name to log for usage tracking. */
  static providerNameForBackend(backend: string): string {
    return backend === 'gemini' ? 'gemini' : 'openai';
  }

  private async resolveProvider(): Promise<{ provider: ImageGenerationProvider; backend: string }> {
    if (Date.now() < this.cacheExpiresAt && this.cachedBackend !== null) {
      const backend = this.cachedBackend;
      return { provider: backend === 'gemini' ? this.nanoBanana : this.openai, backend };
    }

    const row = await this.settingsRepo.findOne({ where: { key: 'IMAGE_GENERATION_BACKEND' } });
    const backend = row?.value ?? 'openai';
    this.cachedBackend = backend;
    this.cacheExpiresAt = Date.now() + ImageProviderDispatcher.CACHE_TTL_MS;

    return { provider: backend === 'gemini' ? this.nanoBanana : this.openai, backend };
  }

  private async resolveAvatarProvider(): Promise<ImageGenerationProvider> {
    if (Date.now() < this.avatarCacheExpiresAt && this.cachedAvatarBackend !== null) {
      return this.cachedAvatarBackend === 'gemini' ? this.nanoBanana : this.openai;
    }

    const row = await this.settingsRepo.findOne({ where: { key: 'AVATAR_GENERATION_BACKEND' } });
    const backend = row?.value ?? 'openai';
    this.cachedAvatarBackend = backend;
    this.avatarCacheExpiresAt = Date.now() + ImageProviderDispatcher.CACHE_TTL_MS;

    return backend === 'gemini' ? this.nanoBanana : this.openai;
  }

  async generateImage(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    const { provider } = await this.resolveProvider();
    return provider.generateImage(input);
  }

  async generateAvatar(input: AvatarGenerationInput): Promise<ImageGenerationOutput> {
    const provider = await this.resolveAvatarProvider();
    if (provider === this.openai) return this.openai.generateAvatar(input);

    // Gemini selected — fall back to OpenAI on safety block or empty response
    try {
      return await this.nanoBanana.generateAvatar(input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gemini avatar failed (${msg.slice(0, 120)}), falling back to OpenAI`);
      return this.openai.generateAvatar(input);
    }
  }

  async describeCharacterAppearance(photoBuffer: Buffer, mimeType?: string): Promise<string | null> {
    const { provider } = await this.resolveProvider();
    return provider.describeCharacterAppearance(photoBuffer, mimeType);
  }

  async describeCharacterAppearanceFromUrl(url: string): Promise<string | null> {
    const { provider } = await this.resolveProvider();
    return provider.describeCharacterAppearanceFromUrl(url);
  }

  async extractStructuredIdentity(description: string): Promise<CharacterIdentity | null> {
    const { provider } = await this.resolveProvider();
    return provider.extractStructuredIdentity(description);
  }

  async checkFaceConsistency(heroAvatarUrl: string, generatedImageBase64: string, heroName: string): Promise<FaceConsistencyResult | null> {
    const { provider } = await this.resolveProvider();
    return provider.checkFaceConsistency(heroAvatarUrl, generatedImageBase64, heroName);
  }

  async checkFaceConsistencyFromUrl(heroAvatarUrl: string, generatedImageUrl: string, heroName: string): Promise<FaceConsistencyResult | null> {
    const { provider } = await this.resolveProvider();
    return provider.checkFaceConsistencyFromUrl(heroAvatarUrl, generatedImageUrl, heroName);
  }

  async locateSpeechBubbleAnchors(input: SpeechBubbleLayoutInput): Promise<SpeechBubbleLayoutResult | null> {
    const { provider } = await this.resolveProvider();
    return provider.locateSpeechBubbleAnchors(input);
  }

  async checkApparentAge(input: ApparentAgeCheckInput): Promise<ApparentAgeCheckResult | null> {
    const { provider } = await this.resolveProvider();
    return provider.checkApparentAge(input);
  }

  async generateCostumedCanonical(input: CostumedCanonicalInput): Promise<ImageGenerationOutput> {
    const { provider } = await this.resolveProvider();
    return provider.generateCostumedCanonical(input);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../../admin/platform-setting.entity';
import type {
  ApparentAgeCheckInput,
  ApparentAgeCheckResult,
  AvatarGenerationInput,
  CharacterSheetInput,
  CostumedCanonicalInput,
  FaceConsistencyResult,
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageGenerationProvider,
  SpeechBubbleLayoutInput,
  SpeechBubbleLayoutResult,
} from '../interfaces/image-generation.provider';
import type { CharacterIdentity } from '../../heroes/hero.entity';
import { ContentSafetyError, ContentSafetyService } from '../content-safety.service';
import { CHILD_SAFE_IMAGE_RULE } from '../gemini-safety';
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
  private cachedAspectRatio: string | null = null;
  private aspectCacheExpiresAt = 0;
  private cachedImageModel: string | null = null;
  private modelCacheExpiresAt = 0;
  private static readonly CACHE_TTL_MS = 30_000;

  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
    private readonly openai: OpenAIImageProvider,
    private readonly nanoBanana: NanoBananaImageProvider,
    private readonly safety: ContentSafetyService,
  ) {}

  /**
   * Every picture a child might see is checked before it is used. A picture that fails is redrawn once
   * with an extra child-safety instruction; if that fails too, a ContentSafetyError is thrown (the story
   * then fails and the credit is refunded).
   */
  private async childSafe(what: string, draw: (safetyNote?: string) => Promise<ImageGenerationOutput>): Promise<ImageGenerationOutput> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const output = await draw(attempt === 0 ? undefined : CHILD_SAFE_IMAGE_RULE);
      if (!output.imageBase64) return output; // URL-only outputs are checked by the provider's own filters
      const verdict = await this.safety.checkImage(output.imageBase64);
      if (verdict.safe) return output;
      this.logger.warn(`Unsafe ${what} (attempt ${attempt + 1}): ${verdict.reasons.join(', ')} — ${attempt === 0 ? 'redrawing' : 'giving up'}`);
    }
    throw new ContentSafetyError(`${what} failed the child-safety check twice`);
  }

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
    const aspectRatio = input.aspectRatio ?? await this.resolveAspectRatio();
    const model = input.model ?? await this.resolveImageModel();
    return this.childSafe('story picture', (note) => provider.generateImage({
      ...input,
      sceneDescription: note ? `${input.sceneDescription}\n${note}` : input.sceneDescription,
      aspectRatio,
      model,
    }));
  }

  /** Which backend + model will draw the next image — used for cost logging. */
  async currentImageModel(): Promise<{ backend: string; model: string }> {
    const { backend } = await this.resolveProvider();
    return { backend, model: backend === 'gemini' ? await this.resolveImageModel() : 'gpt-image-1' };
  }

  async generateCharacterSheet(input: CharacterSheetInput): Promise<ImageGenerationOutput> {
    const { provider, backend } = await this.resolveProvider();
    if (backend !== 'gemini' || !provider.generateCharacterSheet) {
      throw new Error('Character sheets need the Gemini image backend');
    }
    const model = input.model ?? await this.resolveImageModel();
    const generateSheet = provider.generateCharacterSheet.bind(provider);
    return this.childSafe('character sheet', (note) => generateSheet({
      ...input,
      appearance: note ? [input.appearance, note].filter(Boolean).join('. ') : input.appearance,
      model,
    }));
  }

  private async resolveImageModel(): Promise<string> {
    if (Date.now() < this.modelCacheExpiresAt && this.cachedImageModel) return this.cachedImageModel;
    const row = await this.settingsRepo.findOne({ where: { key: 'IMAGE_GENERATION_MODEL' } });
    this.cachedImageModel = row?.value?.trim() || SETTING_DEFAULTS.IMAGE_GENERATION_MODEL.value;
    this.modelCacheExpiresAt = Date.now() + ImageProviderDispatcher.CACHE_TTL_MS;
    return this.cachedImageModel;
  }

  /** One ratio for every illustration — without it pages came back mixed (square and 16:9 in one story). */
  private async resolveAspectRatio(): Promise<string> {
    if (Date.now() < this.aspectCacheExpiresAt && this.cachedAspectRatio) return this.cachedAspectRatio;
    const row = await this.settingsRepo.findOne({ where: { key: 'STORY_IMAGE_ASPECT_RATIO' } });
    this.cachedAspectRatio = row?.value?.trim() || SETTING_DEFAULTS.STORY_IMAGE_ASPECT_RATIO.value;
    this.aspectCacheExpiresAt = Date.now() + ImageProviderDispatcher.CACHE_TTL_MS;
    return this.cachedAspectRatio;
  }

  async generateAvatar(input: AvatarGenerationInput): Promise<ImageGenerationOutput> {
    const provider = await this.resolveAvatarProvider();
    return this.childSafe('avatar', async (note) => {
      const attempt = note ? { ...input, adjustmentHint: [input.adjustmentHint, note].filter(Boolean).join('. ') } : input;
      if (provider === this.openai) return this.openai.generateAvatar(attempt);

      // Gemini selected — no OpenAI fallback any more: the child's photo goes to one provider only.
      // A failure is refunded by the caller, so the parent can simply try again.
      return this.nanoBanana.generateAvatar(attempt);
    });
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

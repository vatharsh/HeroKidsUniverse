import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting } from '../../admin/platform-setting.entity';
import type { NarrationInput, NarrationOutput, NarrationProvider } from '../interfaces/narration.provider';
import { GeminiTTSProvider } from './gemini-tts.provider';
import { OpenAITTSProvider } from './openai-tts.provider';

@Injectable()
export class NarrationProviderDispatcher implements NarrationProvider {
  private readonly logger = new Logger(NarrationProviderDispatcher.name);
  private cachedProvider: 'openai' | 'gemini' | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    @InjectRepository(PlatformSetting) private readonly settingsRepo: Repository<PlatformSetting>,
    private readonly openai: OpenAITTSProvider,
    private readonly gemini: GeminiTTSProvider,
  ) {}

  private async resolveProvider(): Promise<NarrationProvider> {
    const now = Date.now();
    if (!this.cachedProvider || now > this.cacheExpiresAt) {
      try {
        const row = await this.settingsRepo.findOne({ where: { key: 'TTS_PROVIDER' } });
        const value = (row?.value ?? 'openai').toLowerCase();
        this.cachedProvider = value === 'gemini' ? 'gemini' : 'openai';
      } catch {
        this.cachedProvider = 'openai';
      }
      this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    }

    if (this.cachedProvider === 'gemini') {
      this.logger.debug('TTS dispatch → Gemini');
      return this.gemini;
    }
    this.logger.debug('TTS dispatch → OpenAI');
    return this.openai;
  }

  async generateNarration(input: NarrationInput): Promise<NarrationOutput> {
    const provider = await this.resolveProvider();
    return provider.generateNarration(input);
  }
}

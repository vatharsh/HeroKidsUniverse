import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import {
  NarrationInput,
  NarrationOutput,
  NarrationProvider,
} from '../interfaces/narration.provider';
import { PromptRegistryService } from '../prompt-registry.service';

@Injectable()
export class OpenAITTSProvider implements NarrationProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  // Cached template: string = fetched OK; null = confirmed not in DB; undefined = not yet fetched / fetch failed
  private cachedNarrationTemplate: string | null | undefined = undefined;
  // Timestamp of last failed fetch — retry after 5 minutes instead of caching null forever
  private lastFetchFailedAt: number | null = null;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly promptRegistry: PromptRegistryService | null,
  ) {
    const apiKey = this.config.get<string>('OPEN_AI_API_KEY') ?? this.config.get<string>('OPENAI_API_KEY') ?? '';
    this.model = this.config.get<string>('OPENAI_TTS_MODEL') ?? 'gpt-4o-mini-tts';
    this.client = new OpenAI({ apiKey });
  }

  private async getNarrationInstructions(input: NarrationInput): Promise<string> {
    const fallback =
      'Speak with a warm, natural Indian English accent — the kind you would hear from a loving Indian parent or grandparent telling a bedtime story to a young child.\n' +
      'Accent: Indian English throughout — slightly syllable-timed rhythm, gentle rising-and-falling intonation at sentence ends, pure vowels (avoid American diphthong drawl), crisp consonants.\n' +
      'Pace: medium-slow, every word lands clearly for a child aged 5 to 12.\n' +
      'Tone: warm, friendly, soothing but animated — gently stress character names and exciting action words, pause briefly after commas and full stops.\n' +
      'Avoid entirely: American accent, American r-coloured vowels, British RP, over-dramatic Western audiobook style.';

    // Retry if previously failed (don't cache null forever — retry after 5 min)
    const shouldFetch =
      this.cachedNarrationTemplate === undefined ||
      (this.cachedNarrationTemplate === null && this.lastFetchFailedAt !== null && Date.now() - this.lastFetchFailedAt > 5 * 60 * 1000);

    if (shouldFetch) {
      try {
        const version = this.promptRegistry ? await this.promptRegistry.getActivePrompt('narration') : null;
        this.cachedNarrationTemplate = version?.promptText ?? null;
        if (this.cachedNarrationTemplate === null) {
          this.lastFetchFailedAt = null; // DB says no active version — don't retry aggressively
        }
      } catch {
        this.cachedNarrationTemplate = null;
        this.lastFetchFailedAt = Date.now(); // transient error — retry in 5 min
      }
    }

    return this.cachedNarrationTemplate && this.promptRegistry
      ? this.promptRegistry.renderPrompt(this.cachedNarrationTemplate, {
          accentStyle: input.accent ?? 'natural Indian English',
          tone: input.tone ?? 'warm bedtime storyteller',
        })
      : fallback;
  }

  async generateNarration(input: NarrationInput): Promise<NarrationOutput> {
    const instructions = await this.getNarrationInstructions(input);

    const voice = (input.voice ?? 'nova') as Parameters<typeof this.client.audio.speech.create>[0]['voice'];
    const speed = input.speed ?? 0.9;

    const response = await this.client.audio.speech.create({
      model: this.model,
      voice,
      input: input.text,
      speed,
      instructions,
    } as Parameters<typeof this.client.audio.speech.create>[0]);

    return {
      audioUrl: '',
      audioBuffer: Buffer.from(await response.arrayBuffer()),
    };
  }
}

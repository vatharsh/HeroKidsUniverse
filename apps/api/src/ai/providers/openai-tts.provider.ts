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
  private cachedNarrationTemplate: string | null | undefined = undefined;

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
      'Narrate in clear neutral Indian English, like a warm Indian parent or grandparent telling a bedtime story. ' +
      'Use natural Indian pronunciation, Indian English rhythm, and familiar conversational warmth. ' +
      'Keep the tone gentle, friendly, expressive, and easy for children aged 5-12 to understand. ' +
      'Speak medium-slow, with clear syllables and soft excitement during action moments. ' +
      'Avoid American audiobook style, American vowel sounds, British documentary style, and over-dramatic Western narration.';

    if (this.cachedNarrationTemplate === undefined) {
      try {
        const version = this.promptRegistry ? await this.promptRegistry.getActivePrompt('narration') : null;
        this.cachedNarrationTemplate = version?.promptText ?? null;
      } catch {
        this.cachedNarrationTemplate = null;
      }
    }

    return this.cachedNarrationTemplate && this.promptRegistry
      ? this.promptRegistry.renderPrompt(this.cachedNarrationTemplate, {
          pageText: input.text,
          voice: input.voice ?? 'nova',
          speedRatio: String(input.speed ?? 0.9),
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

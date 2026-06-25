import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import {
  NarrationInput,
  NarrationOutput,
  NarrationProvider,
} from '../interfaces/narration.provider';

@Injectable()
export class OpenAITTSProvider implements NarrationProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPEN_AI_API_KEY') ?? this.config.get<string>('OPENAI_API_KEY') ?? '';
    this.model = this.config.get<string>('OPENAI_TTS_MODEL') ?? 'gpt-4o-mini-tts';
    this.client = new OpenAI({ apiKey });
  }

  async generateNarration(input: NarrationInput): Promise<NarrationOutput> {
    const instructions = [
      `Narrate in clear, warm Indian English suitable for ${input.audience ?? 'children'} aged 5-12.`,
      'Use a friendly, engaging storyteller tone — like a loving grandparent telling a bedtime story.',
      'Speak at a medium-slow pace so every word is easy to follow.',
      'Avoid strong American or British accent. Use natural Indian English pronunciation.',
      'Add gentle warmth and excitement to action moments, softness to emotional moments.',
    ].join(' ');

    const response = await this.client.audio.speech.create({
      model: this.model,
      voice: (input.voice ?? 'nova') as any,
      input: input.text,
      instructions,
    } as any);

    return {
      audioUrl: '',
      audioBuffer: Buffer.from(await response.arrayBuffer()),
    };
  }
}

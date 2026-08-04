import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { NarrationInput, NarrationOutput, NarrationProvider } from '../interfaces/narration.provider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeminiSDK = any;

/** Converts raw Linear16 PCM data into a valid WAV buffer. Gemini TTS outputs PCM at 24 kHz mono. */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(dataSize + 36, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

@Injectable()
export class GeminiTTSProvider implements NarrationProvider {
  private readonly logger = new Logger(GeminiTTSProvider.name);
  private genAI: GeminiSDK | null = null;

  constructor(private readonly config: ConfigService) {}

  private getGenAI(): GeminiSDK {
    if (!this.genAI) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GoogleGenerativeAI } = require('@google/generative-ai') as typeof import('@google/generative-ai');
      this.genAI = new GoogleGenerativeAI(this.config.get<string>('GEMINI_API_KEY') ?? '');
    }
    return this.genAI;
  }

  async generateNarration(input: NarrationInput): Promise<NarrationOutput> {
    const voiceName = input.voice ?? this.config.get<string>('GEMINI_TTS_VOICE') ?? 'Kore';
    const genAI = this.getGenAI();

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-tts',
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });

    const accent = input.accent ?? 'Indian English';
    const tone = input.tone ?? 'warm bedtime storyteller';
    const instruction =
      `Read the following in ${accent} with a ${tone} tone — ` +
      `like a loving Indian parent or grandparent reading to a young child. ` +
      `Use slightly syllable-timed rhythm, gentle rising-and-falling intonation, ` +
      `crisp consonants, pure vowels. Pace: medium-slow and clear for a child aged 5–12. ` +
      `Pause briefly after commas and full stops. Gently stress character names and exciting action words.\n\n` +
      input.text;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: instruction }] }],
    });

    const parts: GeminiSDK[] = result?.response?.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((p: GeminiSDK) => p?.inlineData?.mimeType?.startsWith('audio/'));

    if (!audioPart?.inlineData?.data) {
      const textPart = parts.find((p: GeminiSDK) => p?.text)?.text ?? '';
      throw new Error(`Gemini TTS response missing audio data. Text: ${textPart.slice(0, 200)}`);
    }

    const pcm = Buffer.from(audioPart.inlineData.data, 'base64');
    const wav = pcmToWav(pcm);
    this.logger.log(`Gemini TTS generated ${wav.length} bytes WAV (voice=${voiceName})`);

    return { audioUrl: '', audioBuffer: wav };
  }
}

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

/** Seconds of audio in a PCM WAV (reads the fmt byte rate and data chunk size). */
function wavDurationSeconds(wav: Buffer): number {
  try {
    const byteRate = wav.readUInt32LE(28);
    let offset = 12;
    while (offset + 8 <= wav.length) {
      const id = wav.subarray(offset, offset + 4).toString('ascii');
      const size = wav.readUInt32LE(offset + 4);
      if (id === 'data') return byteRate > 0 ? Math.min(size, wav.length - offset - 8) / byteRate : 0;
      offset += 8 + size;
    }
  } catch {
    // fall through
  }
  return 0;
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
    const voiceName = input.voice ?? this.config.get<string>('GEMINI_TTS_VOICE') ?? 'en-in-concierge-5';
    const modelName = input.model ?? 'gemini-3.8-flash-tts';
    const genAI = this.getGenAI();

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });

    // Gemini 3.x TTS reads its input verbatim — accent and warmth come from the chosen voice (an Indian-English
    // library voice), so only the story text is sent. Older 2.5 preview models still take a spoken instruction.
    const isLegacyModel = modelName.startsWith('gemini-2.5');
    const accent = input.accent ?? 'Indian English';
    const tone = input.tone ?? 'warm bedtime storyteller';
    const text = isLegacyModel
      ? `Read the following in ${accent} with a ${tone} tone, like a loving Indian parent or grandparent reading to a young child. ` +
        `Pace: medium-slow and clear. Pause briefly after commas and full stops.\n\n${input.text}`
      : input.text;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text }] }],
    });

    const parts: GeminiSDK[] = result?.response?.candidates?.[0]?.content?.parts ?? [];
    const audioPart = parts.find((p: GeminiSDK) => p?.inlineData?.mimeType?.startsWith('audio/'));

    if (!audioPart?.inlineData?.data) {
      const textPart = parts.find((p: GeminiSDK) => p?.text)?.text ?? '';
      throw new Error(`Gemini TTS response missing audio data. Text: ${textPart.slice(0, 200)}`);
    }

    // 3.x models return a ready WAV; 2.5 returned raw 24 kHz PCM that needs a header.
    const raw = Buffer.from(audioPart.inlineData.data, 'base64');
    const wav = raw.subarray(0, 4).toString('ascii') === 'RIFF' ? raw : pcmToWav(raw);
    const durationSeconds = wavDurationSeconds(wav);
    this.logger.log(`Gemini TTS generated ${wav.length} bytes WAV, ${durationSeconds.toFixed(1)}s (voice=${voiceName}, model=${modelName})`);

    return { audioUrl: '', audioBuffer: wav, durationSeconds };
  }
}

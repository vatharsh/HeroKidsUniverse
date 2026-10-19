import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TtsVoiceOption {
  id: string;
  name: string;
  gender?: string;
  pitch?: string;
  description?: string;
}

interface GeminiVoice {
  id: string;
  display_name?: string;
  gender?: string;
  pitch?: string;
  description?: string;
}

const CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_PAGES = 20;

/** Lists Gemini TTS library voices for the admin voice picker (cached; the list changes rarely). */
@Injectable()
export class TtsVoicesService {
  private readonly logger = new Logger(TtsVoicesService.name);
  private readonly cache = new Map<string, { at: number; voices: TtsVoiceOption[] }>();

  constructor(private readonly config: ConfigService) {}

  async listGeminiVoices(languageCode = 'en-IN'): Promise<TtsVoiceOption[]> {
    const cached = this.cache.get(languageCode);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.voices;

    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) return [];

    const voices: TtsVoiceOption[] = [];
    let pageToken: string | undefined;
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams({ language_code: languageCode, type: 'prebuilt', page_size: '100' });
        if (pageToken) params.set('page_token', pageToken);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/voices?${params}`, {
          headers: { 'x-goog-api-key': key },
        });
        if (!res.ok) throw new Error(`voices API ${res.status}`);
        const body = (await res.json()) as { voices?: GeminiVoice[]; next_page_token?: string };
        for (const v of body.voices ?? []) {
          voices.push({ id: v.id, name: v.display_name ?? v.id, gender: v.gender, pitch: v.pitch, description: v.description });
        }
        pageToken = body.next_page_token;
        if (!pageToken) break;
      }
    } catch (err) {
      this.logger.warn(`Could not list Gemini voices: ${(err as Error).message}`);
      return cached?.voices ?? [];
    }

    voices.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    this.cache.set(languageCode, { at: Date.now(), voices });
    return voices;
  }
}

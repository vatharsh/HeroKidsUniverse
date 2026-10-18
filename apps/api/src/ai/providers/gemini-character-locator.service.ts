import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../../admin/platform-setting.entity';

export interface CastMember {
  name: string;
  /** Short visual description so the model can tell characters apart (age, outfit, role). */
  description: string;
}

export interface CharacterLocation {
  name: string;
  /** Percent of image width/height (0–100). */
  head: { x: number; y: number; width: number; height: number };
  mouth: { x: number; y: number } | null;
}

type Box2d = [number, number, number, number];

/**
 * Finds where each named character's head and mouth are in a finished illustration, using Gemini's
 * native object detection (box_2d on a 0–1000 grid). Used to place speech bubbles on the real speaker.
 */
@Injectable()
export class GeminiCharacterLocator {
  private readonly logger = new Logger(GeminiCharacterLocator.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
  ) {
    this.genAI = new GoogleGenerativeAI(this.config.get<string>('GEMINI_API_KEY') ?? '');
  }

  async locate(params: {
    imageBase64?: string;
    imageUrl?: string;
    cast: CastMember[];
  }): Promise<CharacterLocation[]> {
    if (!params.cast.length) return [];
    const image = params.imageBase64
      ? { data: params.imageBase64, mimeType: 'image/png' }
      : params.imageUrl ? await this.fetchImage(params.imageUrl) : null;
    if (!image) return [];

    const row = await this.settingsRepo.findOne({ where: { key: 'BUBBLE_DETECTION_MODEL' } }).catch(() => null);
    const modelName = row?.value?.trim() || SETTING_DEFAULTS.BUBBLE_DETECTION_MODEL.value;
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });

    const prompt = [
      'You are locating characters in a children\'s storybook illustration so speech bubbles can point at the right mouth.',
      'Characters who may appear:',
      ...params.cast.map((c) => `- ${c.name}: ${c.description}`),
      '',
      'For every listed character that is clearly visible, return:',
      '- "name": exactly as written above',
      '- "head_box": [ymin, xmin, ymax, xmax] tightly around the head (top of hair to chin), normalized 0-1000',
      '- "mouth": [y, x] centre of the mouth normalized 0-1000, or null if the mouth is not visible',
      'Leave out characters that are not visible. Do not guess positions and do not include anyone not listed.',
      'Respond with JSON only: {"characters": [{"name": "...", "head_box": [..], "mouth": [..]}]}',
    ].join('\n');

    const result = await model.generateContent([
      { inlineData: { mimeType: image.mimeType, data: image.data } },
      { text: prompt },
    ]);
    const parsed = JSON.parse(result.response.text()) as {
      characters?: Array<{ name?: string; head_box?: Box2d; mouth?: [number, number] | null }>;
    };

    const known = new Map(params.cast.map((c) => [c.name.toLowerCase(), c.name]));
    return (parsed.characters ?? []).flatMap((c) => {
      const name = c.name ? known.get(c.name.toLowerCase()) : undefined;
      const box = c.head_box;
      if (!name || !Array.isArray(box) || box.length !== 4 || box.some((v) => typeof v !== 'number')) return [];
      const [ymin, xmin, ymax, xmax] = box.map((v) => Math.min(1000, Math.max(0, v)) / 10);
      if (xmax <= xmin || ymax <= ymin) return [];
      const mouth = Array.isArray(c.mouth) && c.mouth.length === 2
        ? { x: Math.min(100, Math.max(0, c.mouth[1] / 10)), y: Math.min(100, Math.max(0, c.mouth[0] / 10)) }
        : null;
      return [{ name, head: { x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin }, mouth }];
    });
  }

  private async fetchImage(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
      const absoluteUrl = url.startsWith('/') ? `http://localhost:${process.env.PORT ?? 3000}${url}` : url;
      const res = await fetch(absoluteUrl, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return null;
      const mimeType = (res.headers.get('content-type') ?? 'image/png').split(';')[0].trim();
      return { data: Buffer.from(await res.arrayBuffer()).toString('base64'), mimeType };
    } catch (err) {
      this.logger.warn(`Could not load image for character detection: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}

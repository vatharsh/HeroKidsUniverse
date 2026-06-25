import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

import {
  AvatarGenerationInput,
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageGenerationProvider,
} from '../interfaces/image-generation.provider';

@Injectable()
export class OpenAIImageProvider implements ImageGenerationProvider {
  private readonly logger = new Logger(OpenAIImageProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPEN_AI_API_KEY') ?? this.config.get<string>('OPENAI_API_KEY') ?? '';
    this.model = this.config.get<string>('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
    this.client = new OpenAI({ apiKey });
  }

  async generateImage(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    const castLine = input.supportingCharacters?.length
      ? `Supporting characters in this scene: ${input.supportingCharacters.join(', ')} — their faces, skin tone, hair, clothing, and age must be IDENTICAL to the reference images provided.`
      : '';

    const prompt = [
      input.style ?? 'professional full-color comic book illustration, dynamic panels, crisp ink lines',
      `Main hero: ${input.heroName}, age ${input.heroAge} — face, skin tone, hair colour and style, clothing MUST match the reference image exactly. Do not alter the hero's appearance in any way.`,
      castLine,
      input.sceneDescription,
      'CHARACTER CONSISTENCY IS MANDATORY: every character must look identical to how they appear in the reference images — same face, same hair, same skin tone, same clothing across every page.',
      'Child-safe, joyful, cinematic, no text overlaid on the image.',
    ].filter(Boolean).join('\n');

    // Reference order: hero avatar, character avatars, then style reference (first page)
    const refs = [
      ...(input.heroAvatarUrl           ? [{ url: input.heroAvatarUrl, name: 'hero.png' }]              : []),
      ...(input.characterAvatarUrls ?? []).map((url, i) => ({ url, name: `char-${i}.png` })),
      ...(input.styleReferenceUrl        ? [{ url: input.styleReferenceUrl, name: 'style_ref.png' }]    : []),
    ];

    if (refs.length > 0) {
      const files = (
        await Promise.all(refs.map(r => this.urlToFile(r.url, r.name)))
      ).filter((f): f is Awaited<ReturnType<typeof toFile>> => f !== null);

      if (files.length > 0) {
        try {
          const edited = await this.client.images.edit({
            model: this.model,
            image: files,
            prompt,
            n: 1,
            size: '1024x1024',
          });
          return this.fromImageResponse(edited);
        } catch (err) {
          this.logger.warn(
            `images.edit failed (${refs.length} refs), falling back to generate: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

    const response = await this.client.images.generate({
      model: this.model,
      prompt,
      n: 1,
      size: '1024x1024',
    });

    return this.fromImageResponse(response);
  }

  private async urlToFile(url: string, name: string): Promise<Awaited<ReturnType<typeof toFile>> | null> {
    // DiceBear returns SVGs — not accepted by images.edit, skip immediately
    if (url.includes('dicebear.com') || url.endsWith('.svg')) return null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('svg')) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      return toFile(buffer, name, { type: 'image/png' });
    } catch {
      return null;
    }
  }

  async generateAvatar(input: AvatarGenerationInput): Promise<ImageGenerationOutput> {
    const adjustmentLine = input.adjustmentHint
      ? `Specific adjustment requested: ${input.adjustmentHint}`
      : '';

    const prompt = [
      'Create a high-quality portrait that looks almost identical to the reference photo.',
      'IDENTITY PRESERVATION IS THE TOP PRIORITY — the output must be instantly recognisable as the same person:',
      '• Keep the exact face shape, facial proportions, and bone structure.',
      '• Keep the exact skin tone and complexion.',
      '• Keep the exact hairstyle, hair colour, hair length, and hair texture — do not alter it in any way.',
      '• Keep the exact eye shape, eye colour, and gaze direction.',
      '• Keep the exact facial expression and emotion — if they are smiling, keep that smile; if they look serious, keep that.',
      '• Keep any distinctive features: glasses, freckles, dimples, moles, birthmarks, braces.',
      '• Keep the same age appearance.',
      'Allowed changes ONLY: replace the background with a clean soft-gradient or neutral studio background; apply subtle, flattering portrait lighting to make the subject look their best.',
      'Style: photorealistic portrait with a very slight painterly polish — NOT a cartoon, NOT an illustration, NOT anime, NOT a stylised character.',
      'The result should look like a polished professional photo of the same person, not a drawing of them.',
      adjustmentLine,
      input.role ? `Role context (do not change appearance for this — it is only for subtle heroic confidence in the pose): ${input.role}.` : '',
      'Single portrait, head and shoulders, no text, no watermark, no border.',
    ].filter(Boolean).join('\n');

    try {
      if (input.photoBuffer) {
        const image = await toFile(
          input.photoBuffer,
          'character-reference.png',
          { type: input.photoMimeType ?? 'image/png' },
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const edited = await (this.client.images.edit as any)({
          model: this.model,
          image,
          prompt,
          n: 1,
          size: '1024x1024',
          quality: 'high',
        });
        return this.fromImageResponse(edited);
      }
    } catch {
      // Fall through to text-to-image generation below. The caller logs the failure context.
    }

    const generated = await this.client.images.generate({
      model: this.model,
      prompt,
      n: 1,
      size: '1024x1024',
    });

    return this.fromImageResponse(generated);
  }

  private fromImageResponse(response: OpenAI.Images.ImagesResponse): ImageGenerationOutput {
    const image = response.data?.[0];
    if (!image) {
      return { imageUrl: '' };
    }

    if (image.b64_json) {
      return {
        imageUrl: `data:image/png;base64,${image.b64_json}`,
        imageBase64: image.b64_json,
      };
    }

    return { imageUrl: image.url ?? '' };
  }
}

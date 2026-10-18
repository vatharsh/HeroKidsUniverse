import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ApparentAgeCheckInput,
  ApparentAgeCheckResult,
  AvatarGenerationInput,
  CostumedCanonicalInput,
  FaceConsistencyResult,
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageGenerationProvider,
  SpeechBubbleLayoutInput,
  SpeechBubbleLayoutResult,
} from '../interfaces/image-generation.provider';
import type { CharacterIdentity } from '../../heroes/hero.entity';
import { OpenAIImageProvider } from './openai-image.provider';
import { AVATAR_STYLE, STORYBOOK_STYLE } from '../style.constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeminiSDK = any;

/**
 * Image provider backed by Gemini 3.1 Flash Image (Nano Banana 2).
 *
 * generateImage       — native Gemini image generation with multi-reference inlineData
 * All vision methods  — delegate to OpenAIImageProvider (GPT-4V remains best for vision QA)
 * generateAvatar      — delegate to OpenAIImageProvider
 *
 * The Gemini image model accepts TRUE arrays of reference images, which gives better
 * cross-page character consistency than the composite-image workaround used by other models.
 *
 * Prompt discipline: keep text under 512 tokens (model limit). The prompt builder
 * prioritises identity anchors and scene description, collapsing verbose prose.
 */
@Injectable()
export class NanoBananaImageProvider implements ImageGenerationProvider {
  private readonly logger = new Logger(NanoBananaImageProvider.name);
  static readonly IMAGE_MODEL = 'gemini-3.1-flash-image';

  private genAI: GeminiSDK | null = null;
  private sdkLoaded = false;

  constructor(
    private readonly config: ConfigService,
    private readonly openai: OpenAIImageProvider,
  ) {}

  private getGenAI(): GeminiSDK {
    if (!this.genAI) {
      // Dynamic import keeps the require isolated so the SDK is shared with story provider
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GoogleGenerativeAI } = require('@google/generative-ai') as typeof import('@google/generative-ai');
      const apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.sdkLoaded = true;
    }
    return this.genAI;
  }

  // ── URL → base64 ──────────────────────────────────────────────────────────────

  private async urlToBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
      // Locally stored uploads are saved as relative paths (/api/upload/files/...) that this API serves itself.
      const absoluteUrl = url.startsWith('/') ? `http://localhost:${process.env.PORT ?? 3000}${url}` : url;
      const res = await fetch(absoluteUrl, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const ct = res.headers.get('content-type') ?? 'image/jpeg';
      const mimeType = ct.split(';')[0].trim();
      return { data: Buffer.from(buf).toString('base64'), mimeType };
    } catch (err) {
      this.logger.warn(`urlToBase64 failed for ${url}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  // ── Prompt builder (≤512 tokens) ─────────────────────────────────────────────

  private buildPrompt(input: ImageGenerationInput, referenceCount: number): string {
    const style = input.style ?? STORYBOOK_STYLE;
    const lines: string[] = [];

    // Style anchor — always first so it governs visual output
    lines.push(`STYLE: ${style}`);

    // Hero identity
    if (referenceCount > 0 && input.heroAvatarUrl) {
      // Allow longer descriptions — 200 chars often cuts off key face features
      const identitySource = input.heroCanonSummary
        ? input.heroCanonSummary.slice(0, 350)
        : input.heroAvatarDescription
          ? input.heroAvatarDescription.slice(0, 300)
          : 'see reference image #1';

      // Extract skin tone from identity description for an explicit lock (model tends to lighten South Asian skin)
      const identityLower = identitySource.toLowerCase();
      const skinToneMatch = identityLower.match(/(?:skin|complexion)[^.;,]{0,80}(?:dark|medium|brown|tan|olive|deep|warm|dusky|wheatish|caramel)/i);
      const skinToneLock = skinToneMatch
        ? `SKIN TONE LOCKED — do NOT lighten or alter (${skinToneMatch[0].trim()}).`
        : `SKIN TONE LOCKED — match reference #1 exactly. Do NOT lighten or brighten. South Asian / Brown skin must be preserved.`;

      const heroLines = [
        `HERO (LOCKED — ref #1): ${input.heroName}, age ${input.heroAge}.`,
        identitySource,
        skinToneLock,
        `Face geometry LOCKED to ref #1: same face shape, eye shape, nose, lips, jawline, ear shape — copy exactly, do NOT redesign.`,
        `Hair LOCKED to ref #1: same length, cut, texture, colour — no restyling of any kind.`,
        `THIS IS THE SAME PERSON in every scene of this story. Do not create a new character — reproduce ref #1's face with pixel-level fidelity.`,
      ];
      lines.push(heroLines.join(' '));

      // Face metrics — structured identity data (eye spacing, nose width, jaw measurements) for tighter anchoring
      if (input.heroFaceMetrics) {
        lines.push(`HERO FACE METRICS (use as exact targets):\n${input.heroFaceMetrics}`);
      }

      if (input.heroNeverChangeRules?.length) {
        lines.push(`HERO NEVER-CHANGE RULES:\n${input.heroNeverChangeRules.map((r) => `- ${r}`).join('\n')}`);
      }
    } else {
      lines.push(`HERO: ${input.heroName}, age ${input.heroAge}.`);
    }

    // Story visual state — costume is a HARD LOCK, not a suggestion
    if (input.storyVisualState) {
      const sv = input.storyVisualState;
      const costumeParts: string[] = [];
      if (sv.costume) {
        // Copyright-safe: treat user description as inspiration, generate original design
        costumeParts.push(
          `HERO COSTUME (LOCKED — original design inspired by: "${sv.costume}"). ` +
          `Create a fully ORIGINAL outfit. Do NOT reproduce any trademarked or copyrighted character design. ` +
          `Use general aesthetic principles (colour palette, armour style, emblem shape) but make it entirely new. ` +
          `This exact costume appears on the hero in EVERY page of this story — never change it.`,
        );
      } else {
        // No user-defined costume — still lock whatever outfit appears on page 1
        costumeParts.push(
          `HERO OUTFIT LOCK: Whatever the hero wears on page 1 is their established look for this ENTIRE story. ` +
          `Do NOT change the hero's clothing on any subsequent page — keep it identical.`,
        );
      }
      if (sv.companion) costumeParts.push(`companion: ${sv.companion}`);
      if (sv.weapon) costumeParts.push(`weapon: ${sv.weapon}`);
      if (sv.powers?.length) costumeParts.push(`powers visual: ${sv.powers.join(', ')}`);
      if (costumeParts.length) lines.push(`VISUAL STATE:\n${costumeParts.map(p => `- ${p}`).join('\n')}`);

      // Per-character outfit lock from storyVisualState.characterOutfits
      const charOutfits = sv.characterOutfits;
      if (charOutfits && Object.keys(charOutfits).length) {
        const outfitLines = Object.entries(charOutfits)
          .map(([name, outfit]) => `- ${name.toUpperCase()}: LOCKED outfit this story — "${outfit}". Do NOT change this in any page.`);
        lines.push(`CHARACTER OUTFIT LOCK (entire story):\n${outfitLines.join('\n')}`);
      }
    }

    // USER-AUTHORED CHARACTER BIBLES — injected first, highest authority
    // These override all AI-inferred descriptions. Placed before CAST so the model
    // reads the hard rules before it sees anything else about the characters.
    const bibleBlocks = (input.characterBibles ?? []).filter(Boolean);
    if (bibleBlocks.length) {
      lines.push(`CHARACTER BIBLES — ABSOLUTE RULES (override everything else):\n${bibleBlocks.join('\n\n')}`);
    }

    // Supporting characters — reference images follow hero
    if (input.supportingCharacters?.length) {
      const heroRefCount = input.heroAvatarUrl ? 1 : 0;
      const charLines = input.supportingCharacters.map((label, i) => {
        const refNum = heroRefCount + i + 1;
        const hasRef = referenceCount >= refNum; // only claim LOCKED if the reference actually loaded
        const desc = input.characterCanonSummaries?.[i] ?? input.characterAvatarDescriptions?.[i];
        const descText = desc ? `: ${desc.slice(0, 300)}` : '';
        const lockText = hasRef
          ? ` (LOCKED — ref #${refNum} — face geometry, skin tone, hair IDENTICAL to ref. SAME PERSON every scene.)`
          : '';
        return `${label}${lockText}${descText}`;
      });
      lines.push(`CAST:\n${charLines.join('\n')}`);

      // Per-character skin-tone locks (same South-Asian lightening bias affects supporting chars)
      const charSkinBlocks = input.supportingCharacters.map((label, i) => {
        const hasRef = referenceCount >= (heroRefCount + i + 1);
        if (!hasRef) return null;
        const name = label.split('(')[0].trim().toUpperCase();
        return `${name} SKIN TONE: LOCKED — do NOT lighten or alter the skin tone from reference image. South Asian / Brown skin must be preserved exactly.`;
      }).filter(Boolean);
      if (charSkinBlocks.length) lines.push(charSkinBlocks.join('\n'));

      // Per-character never-change rules — same pattern as hero, ensures model respects each character
      const charRuleBlocks = input.supportingCharacters
        .map((label, i) => {
          const rules = input.characterNeverChangeRules?.[i];
          if (!rules?.length) return null;
          const name = label.split('(')[0].trim().toUpperCase();
          return `${name} NEVER-CHANGE RULES:\n${rules.map((r) => `- ${r}`).join('\n')}`;
        })
        .filter(Boolean);
      if (charRuleBlocks.length) lines.push(charRuleBlocks.join('\n'));

      // Extract known accessories across all character descriptions so the lock is explicit
      const ACCESSORY_KEYWORDS = ['glasses', 'spectacles', 'specs', 'bindi', 'beard', 'moustache', 'mustache', 'turban', 'hijab', 'earrings', 'jewellery', 'jewelry', 'freckles', 'braces', 'dimples'];
      const allDescs = [
        input.heroCanonSummary ?? input.heroAvatarDescription ?? '',
        ...(input.characterCanonSummaries ?? input.characterAvatarDescriptions ?? []),
      ].join(' ').toLowerCase();
      const detectedAccessories = ACCESSORY_KEYWORDS.filter((kw) => allDescs.includes(kw));
      const accessoryClause = detectedAccessories.length
        ? ` Known accessories MANDATORY — never omit or alter: ${detectedAccessories.join(', ')}.`
        : '';

      lines.push(
        `CHARACTER CONSISTENCY LOCK: Every character must be IDENTICAL to their reference image across ALL scenes. ` +
        `Same exact age (do NOT age up or de-age anyone). Same face geometry, skin tone — do NOT lighten any character's skin. ` +
        `Same hair colour AND hair length — do NOT restyle hair.${accessoryClause} ` +
        `Do NOT invent or remove accessories.`,
      );

      // Height/scale lock — prevents characters from shrinking or growing between pages
      lines.push(
        `CHARACTER SCALE LOCK: The height and body size of EVERY character relative to the hero must remain IDENTICAL across all pages. ` +
        `If a character is taller or shorter than the hero in page 1, that exact ratio is FROZEN. Never rescale any character between scenes.`,
      );

      // Companion full-body rule — applies to ANY companion type (robot, animal, creature, etc.)
      const companionName = input.storyVisualState?.companion
        ? input.storyVisualState.companion.split('(')[0].trim()
        : null;
      if (companionName) {
        lines.push(
          `COMPANION FULL BODY RULE: ${companionName} (the hero's companion) must be shown with their COMPLETE body visible — head to feet — in every scene. ` +
          `Never crop or cut off any part of the companion's body at the frame edge. If in the background, scale them down but keep the full figure visible.`,
        );
      }
    }

    // Character directions — condensed per-character
    if (input.characterDirections?.length) {
      const dirs = input.characterDirections.map((c) => {
        const parts = [`${c.name}: ${c.expression}`];
        if (c.pose) parts.push(c.pose);
        if (c.position) parts.push(c.position);
        if (c.isSpeaking) parts.push('mouth open (animated expression)');
        return parts.join(', ');
      });
      lines.push(`DIRECTIONS: ${dirs.join(' | ')}`);
    } else if (input.characters?.length) {
      const dirs = input.characters
        .filter(c => c.expression || c.pose)
        .map(c => `${c.name}: ${[c.expression, c.pose].filter(Boolean).join(', ')}`);
      if (dirs.length) lines.push(`DIRECTIONS: ${dirs.join(' | ')}`);
    }

    // Camera
    if (input.camera) lines.push(`CAMERA: ${input.camera}`);

    // Identity boost
    if (input.identityBoostMode) {
      lines.push(`IDENTITY RECOVERY: match approved avatar face exactly — face shape, skin tone, hair, eyes, age.`);
    }

    // Scene
    lines.push(`SCENE: ${input.sceneDescription}`);

    // Hard rules (always at end)
    lines.push(
      `All faces must be clearly visible and recognisable. ` +
      `Render in the cinematic 3D style specified above — NOT flat 2D cartoon. ` +
      `No text, letters, or speech bubbles in the image. Child-safe, joyful.`,
    );

    return lines.filter(Boolean).join('\n');
  }

  // ── generateImage ─────────────────────────────────────────────────────────────

  async generateImage(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    if (input.backgroundOnlyMode) {
      // Background-only mode: strip hero references, generate scene only
      return this.generateImageInternal({ ...input, heroAvatarUrl: undefined, heroAvatarDescription: undefined, heroCanonSummary: undefined, heroNeverChangeRules: undefined, heroFaceMetrics: undefined });
    }
    return this.generateImageInternal(input);
  }

  private async generateImageInternal(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    // Build reference image parts
    const refUrls: Array<{ url: string; label: string }> = [];
    if (input.heroAvatarUrl) refUrls.push({ url: input.heroAvatarUrl, label: `HERO — ${input.heroName}. Copy this face, hair and skin tone exactly.` });
    (input.characterAvatarUrls ?? []).forEach((url, i) => {
      const name = input.supportingCharacters?.[i]?.split('(')[0].trim() ?? `character ${i + 1}`;
      refUrls.push({ url, label: `CHARACTER — ${name}. Copy this face, hair and skin tone exactly.` });
    });
    if (input.styleReferenceUrl) {
      refUrls.push({
        url: input.styleReferenceUrl,
        label: 'EARLIER PAGE of this same story — match its art style, lighting and every character\'s outfit. Do not copy its composition or poses.',
      });
    }

    const refData = await Promise.all(refUrls.map(r => this.urlToBase64(r.url)));
    // Keep labels aligned with the images that actually loaded, so "reference #1" really is the hero.
    const loadedRefs = refUrls
      .map((ref, i) => ({ ...ref, data: refData[i] }))
      .filter((ref): ref is typeof ref & { data: NonNullable<typeof ref.data> } => ref.data !== null);
    // Only face references count toward the hero/character "ref #N" numbering in the prompt.
    const faceRefCount = loadedRefs.filter((ref) => !ref.label.startsWith('EARLIER PAGE')).length;

    const promptText = this.buildPrompt(input, faceRefCount);

    // Interleave a text label before each image so the model can tell the references apart.
    const parts: GeminiSDK[] = [];
    loadedRefs.forEach((ref, i) => {
      parts.push({ text: `Reference image #${i + 1}: ${ref.label}` });
      parts.push({ inlineData: { mimeType: ref.data.mimeType, data: ref.data.data } });
    });
    parts.push({ text: promptText });

    const genAI = this.getGenAI();
    // responseModalities must be set at model-init time, not in generateContent
    const model = genAI.getGenerativeModel({
      model: NanoBananaImageProvider.IMAGE_MODEL,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        ...(input.aspectRatio ? { imageConfig: { aspectRatio: input.aspectRatio } } : {}),
      } as GeminiSDK,
    });

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts }],
        });

        // Extract the image part from the response
        const responseParts: GeminiSDK[] = result?.response?.candidates?.[0]?.content?.parts ?? [];
        this.logger.debug(`Nano Banana response parts: ${responseParts.map((p: GeminiSDK) => p?.inlineData?.mimeType ?? 'text').join(', ')}`);

        const imagePart = responseParts.find(
          (p: GeminiSDK) => p?.inlineData?.mimeType?.startsWith('image/'),
        );

        if (!imagePart?.inlineData?.data) {
          const textPart = responseParts.find((p: GeminiSDK) => p?.text)?.text ?? '';
          throw new Error(`Gemini image response missing inlineData. Parts: ${responseParts.length}. Text: ${textPart.slice(0, 200)}`);
        }

        return { imageUrl: '', imageBase64: imagePart.inlineData.data };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;
        this.logger.error(`Nano Banana attempt ${attempt + 1} failed: ${msg.slice(0, 300)}`);

        // Retry on quota / transient errors with backoff
        if (msg.includes('429') || msg.includes('503') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('high demand')) {
          const delay = Math.min(30_000, 5_000 * (attempt + 1));
          this.logger.warn(`Nano Banana 429 on attempt ${attempt + 1}, waiting ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('Nano Banana image generation failed after retries');
  }

  // ── Avatar generation (Gemini) ────────────────────────────────────────────────

  async generateAvatar(input: AvatarGenerationInput): Promise<ImageGenerationOutput> {
    const parts: GeminiSDK[] = [];

    // Avoid "photo"/"real person" language — Gemini safety filters block those phrasings
    const prompt = [
      `TASK: Re-render this reference image in the following style: ${AVATAR_STYLE}`,
      'Change the RENDERING STYLE only — do not alter the person, their face, or any feature.',
      '',
      'FACE GEOMETRY — PRESERVE EXACTLY (do not alter any of these):',
      '• Face shape and silhouette: oval / round / square / heart / long — keep as-is',
      '• Facial proportions: width-to-height ratio, forehead height, jaw width and chin shape',
      '• Nose: bridge width, tip shape, nostril width — exact',
      '• Lips: fullness, cupid\'s bow, width relative to face — exact',
      '• Eyes: size, spacing, tilt, corner shape, depth — exact',
      '• Eyebrows: arch, thickness, spacing, length — exact',
      '• Skin tone and undertone — exact same shade, do NOT lighten',
      '• Age appearance — do NOT make younger or smoother',
      '• Distinctive features: glasses, beard, moustache, freckles, dimples, moles, birthmarks',
      '',
      'HAIR — PRESERVE EXACTLY:',
      '• Hairstyle, parting, volume, length, texture — exact',
      '• Hair colour — exact same shade',
      '',
      'WHAT YOU MAY CHANGE (rendering only):',
      `• Apply the target style: ${AVATAR_STYLE}`,
      '• Replace background with a soft neutral gradient studio background',
      '',
      'DO NOT normalise, idealise, or alter the face geometry. The output must be instantly recognisable as the same person.',
      input.adjustmentHint ? `SPECIFIC ADJUSTMENT: ${input.adjustmentHint}` : '',
      input.role ? `CHARACTER ROLE (pose confidence only — do not change appearance): ${input.role}` : '',
      'OUTPUT: single portrait, head and shoulders, centred, child-safe. No text, no watermark, no border.',
    ].filter(Boolean).join('\n');

    parts.push({ text: prompt });

    if (input.photoBuffer) {
      parts.push({ inlineData: { mimeType: input.photoMimeType ?? 'image/jpeg', data: input.photoBuffer.toString('base64') } });
    }

    const genAI = this.getGenAI();
    const model = genAI.getGenerativeModel({
      model: NanoBananaImageProvider.IMAGE_MODEL,
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts }],
        });

        const candidate = result?.response?.candidates?.[0];
        const finishReason: string = candidate?.finishReason ?? 'UNKNOWN';
        const promptFeedback = result?.response?.promptFeedback;
        const responseParts: GeminiSDK[] = candidate?.content?.parts ?? [];

        this.logger.debug(
          `Nano Banana avatar finishReason=${finishReason} parts=${responseParts.length}` +
          (promptFeedback?.blockReason ? ` blockReason=${promptFeedback.blockReason}` : ''),
        );

        // Safety block — no point retrying, fall through to throw so dispatcher can fall back
        if (finishReason === 'SAFETY' || promptFeedback?.blockReason) {
          throw new Error(`SAFETY_BLOCK:finishReason=${finishReason} block=${promptFeedback?.blockReason ?? 'none'}`);
        }

        const imagePart = responseParts.find(
          (p: GeminiSDK) => p?.inlineData?.mimeType?.startsWith('image/'),
        );

        if (!imagePart?.inlineData?.data) {
          const textPart = responseParts.find((p: GeminiSDK) => p?.text)?.text ?? '';
          throw new Error(`Gemini avatar response missing inlineData. finishReason=${finishReason} parts=${responseParts.length} text=${textPart.slice(0, 200)}`);
        }

        return { imageUrl: '', imageBase64: imagePart.inlineData.data };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;
        this.logger.error(`Nano Banana avatar attempt ${attempt + 1} failed: ${msg.slice(0, 300)}`);

        // Do not retry safety blocks — fall through immediately
        if (msg.startsWith('SAFETY_BLOCK')) throw lastError;

        if (msg.includes('429') || msg.includes('503') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('high demand')) {
          const delay = Math.min(30_000, 5_000 * (attempt + 1));
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error('Nano Banana avatar generation failed after retries');
  }

  describeCharacterAppearance(photoBuffer: Buffer, mimeType?: string): Promise<string | null> {
    return this.openai.describeCharacterAppearance(photoBuffer, mimeType);
  }

  describeCharacterAppearanceFromUrl(url: string): Promise<string | null> {
    return this.openai.describeCharacterAppearanceFromUrl(url);
  }

  extractStructuredIdentity(description: string): Promise<CharacterIdentity | null> {
    return this.openai.extractStructuredIdentity(description);
  }

  checkFaceConsistency(heroAvatarUrl: string, generatedImageBase64: string, heroName: string): Promise<FaceConsistencyResult | null> {
    return this.openai.checkFaceConsistency(heroAvatarUrl, generatedImageBase64, heroName);
  }

  checkFaceConsistencyFromUrl(heroAvatarUrl: string, generatedImageUrl: string, heroName: string): Promise<FaceConsistencyResult | null> {
    return this.openai.checkFaceConsistencyFromUrl(heroAvatarUrl, generatedImageUrl, heroName);
  }

  locateSpeechBubbleAnchors(input: SpeechBubbleLayoutInput): Promise<SpeechBubbleLayoutResult | null> {
    return this.openai.locateSpeechBubbleAnchors(input);
  }

  checkApparentAge(input: ApparentAgeCheckInput): Promise<ApparentAgeCheckResult | null> {
    return this.openai.checkApparentAge(input);
  }

  generateCostumedCanonical(input: CostumedCanonicalInput): Promise<ImageGenerationOutput> {
    return this.openai.generateCostumedCanonical(input);
  }
}

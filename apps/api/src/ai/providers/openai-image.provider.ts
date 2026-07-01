import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { basename, join } from 'path';

import {
  AvatarGenerationInput,
  FaceConsistencyResult,
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageGenerationProvider,
  SpeechBubbleLayoutInput,
  SpeechBubbleLayoutResult,
} from '../interfaces/image-generation.provider';
import type { CharacterIdentity } from '../../heroes/hero.entity';
import { PromptRegistryService } from '../prompt-registry.service';

@Injectable()
export class OpenAIImageProvider implements ImageGenerationProvider {
  private readonly logger = new Logger(OpenAIImageProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
  ) {
    const apiKey = this.config.get<string>('OPEN_AI_API_KEY') ?? this.config.get<string>('OPENAI_API_KEY') ?? '';
    this.model = this.config.get<string>('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
    this.client = new OpenAI({ apiKey, timeout: 5 * 60 * 1000 }); // 5-minute per-call timeout
  }

  /** Always fetches fresh — no in-memory cache so admin prompt changes take effect immediately. */
  private async getPromptTemplateText(promptKey: string): Promise<string | null> {
    try {
      const version = await this.promptRegistry.getActivePrompt(promptKey);
      return version?.promptText ?? null;
    } catch {
      return null;
    }
  }

  /** Returns the active image_generation template if it is a real (non-legacy) DB version. */
  private async getActiveImageTemplate(): Promise<string | null> {
    const text = await this.getPromptTemplateText('image_generation');
    if (!text || text.startsWith('[CODE_MANAGED') || text.startsWith('[Prompt text managed in code')) return null;
    return text;
  }

  private async renderRegistryPrompt(
    promptKey: string,
    variables: Record<string, string>,
    fallback: string,
  ): Promise<string> {
    const template = await this.getPromptTemplateText(promptKey);
    if (template) {
      return this.promptRegistry.renderPrompt(template, variables);
    }
    return fallback;
  }

  private getIdentityQaFallback(heroName: string): string {
    return (
      `Image 1 is the approved cartoon avatar of a child named ${heroName}. ` +
      `Image 2 is a generated storybook illustration that must depict the same child.\n` +
      `Compare face identity in detail: face shape, skin tone, hairstyle, hair colour, eye shape, eyebrows, nose, mouth/smile, cheeks/jawline, age appearance, glasses/accessories, distinctive features, and overall resemblance.\n` +
      `Ignore differences in background, pose, lighting, and clothing unless they hide or alter the face. Penalize generic cartoon/Pixar/anime face drift heavily.\n` +
      `Score consistency 1–10 (10 = near-perfect match, 1 = completely different child).\n` +
      `Return ONLY valid JSON:\n` +
      `{"identityScore": 8, "issues": ["hairstyle lengthened"], "suggestions": ["restore shorter wavy hair"], "recommendation": "accept"}\n` +
      `recommendation = "accept" when identityScore >= 7; "regenerate" when < 7. issues and suggestions are empty arrays if none.`
    );
  }

  private async getIdentityQaPrompt(heroName: string): Promise<string> {
    return this.renderRegistryPrompt('identity_qa', { heroName }, this.getIdentityQaFallback(heroName));
  }

  async generateImage(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    // Resolve reference images before building the prompt so we know what's available
    const refSpecs = [
      ...(input.heroAvatarUrl         ? [{ url: input.heroAvatarUrl,    name: 'hero.png' }]          : []),
      ...(input.characterAvatarUrls ?? []).map((url, i) => ({ url, name: `char-${i}.png` })),
    ];

    const files = refSpecs.length > 0
      ? (await Promise.all(refSpecs.map(r => this.urlToFile(r.url, r.name))))
          .filter((f): f is Awaited<ReturnType<typeof toFile>> => f !== null)
      : [];

    const hasRef = files.length > 0;
    const expectedRefs = refSpecs.length > 0;
    const allowReferenceFallback = this.config.get<string>('OPENAI_IMAGE_ALLOW_REFERENCELESS_FALLBACK') === 'true';
    const imageQuality = this.config.get<string>('OPENAI_IMAGE_QUALITY') ?? 'low';
    const dbImageTemplate = await this.getActiveImageTemplate();

    const referenceOrderLine = refSpecs.length
      ? [
          'REFERENCE IMAGE ORDER:',
          input.heroAvatarUrl ? `1. ${input.heroName} main hero reference portrait.` : '',
          ...(input.characterAvatarUrls ?? []).map((_, index) => {
            const number = input.heroAvatarUrl ? index + 2 : index + 1;
            return `${number}. ${input.supportingCharacters?.[index] ?? `Supporting character ${index + 1}`} reference portrait.`;
          }),
          'Use these reference portraits as IDENTITY REFERENCES, not style references.',
          'The first reference is the approved avatar identity. Preserve face shape, skin tone, hairstyle, hair colour, eye shape, nose, mouth, ears, smile, age appearance, facial hair, bindi, glasses, and distinctive features.',
          'Apply storybook style only to brushwork, lighting, colour palette, clothing rendering, and background. Do not stylize or redesign facial anatomy.',
        ].filter(Boolean).join('\n')
      : '';

    const castLine = input.supportingCharacters?.length
      ? [
          'SUPPORTING CHARACTER IDENTITIES — draw these recurring characters consistently and exactly as described:',
          ...input.supportingCharacters.map((label, index) => {
            const canonSummary = input.characterCanonSummaries?.[index];
            const description = canonSummary ?? input.characterAvatarDescriptions?.[index];
            return description
              ? `${label}: ${description}`
              : `${label}: use the scene description and reference image if available; keep age, skin tone, hair, face, and clothing consistent.`;
          }),
        ].join('\n')
      : '';

    // heroAvatarDescription (from GPT-4V analysis of the original photo) is the most reliable
    // identity anchor — gpt-image-1 follows text descriptions faithfully across style changes.
    const heroIdentityLine = input.heroCanonSummary
      ? [
          `HERO CANON IDENTITY — draw ${input.heroName} EXACTLY as described. The approved avatar is an IDENTITY REFERENCE, not merely a style reference. Do not change facial anatomy:`,
          input.heroCanonSummary,
          `Age: ${input.heroAge} years old.`,
          input.heroNeverChangeRules?.length
            ? `NEVER-CHANGE RULES:\n${input.heroNeverChangeRules.map((r) => `- ${r}`).join('\n')}`
            : '',
          input.heroFaceMetrics
            ? `FACE METRICS (use as anchor): ${input.heroFaceMetrics}`
            : '',
          'The artistic style may affect only brushwork, lighting, colours, background, and rendering. It must NOT stylize facial anatomy. Do not enlarge eyes, round cheeks, shrink the nose, change the smile, change the hairstyle, change skin tone, or turn the child into a generic cartoon/Pixar/anime child.',
        ].filter(Boolean).join('\n')
      : input.heroAvatarDescription
        ? [
            `HERO IDENTITY — draw ${input.heroName} EXACTLY as described below in every panel:`,
            input.heroAvatarDescription,
            `Age: ${input.heroAge} years old. Preserve face shape, ears, eyes, smile, mouth, nose, hairline, hairstyle, skin tone, and age. The style may change the painting technique, but not facial anatomy. This is a real child — their parents must recognise them instantly.`,
          ].join(' ')
        : `The main character is ${input.heroName} (age ${input.heroAge}). ` +
          `STYLE TRANSFER the reference portrait to storybook illustration style: keep the EXACT same face shape, ` +
          `skin tone, hair colour, hair style, and eye shape. Do not invent a new character.`;

    const storyStateLockLine = input.storyVisualState
      ? [
          'STORY VISUAL STATE (LOCKED for this entire story — draw EXACTLY as specified, do not deviate):',
          `Costume: ${input.storyVisualState.costume ?? 'Regular casual clothes'}`,
          input.storyVisualState.companion
            ? `Companion: ${input.storyVisualState.companion} — always visible nearby, consistent appearance across all pages`
            : '',
          input.storyVisualState.weapon
            ? `Weapon/Item: ${input.storyVisualState.weapon} — in hero's hand or clearly at their side`
            : '',
          input.storyVisualState.powers.length
            ? `Active Powers: ${input.storyVisualState.powers.join(', ')} — show visual effect (glow, aura, spark)`
            : '',
          input.storyVisualState.inventory.length
            ? `Inventory visible: ${input.storyVisualState.inventory.join(', ')}`
            : '',
          'The costume and companion are COSTUME LOCKED — same colour, same design, same silhouette on every page.',
        ].filter(Boolean).join('\n')
      : '';

    const characterDirectionLine = (input.characterDirections?.length ?? 0) > 0
      ? [
          'CHARACTER DIRECTIONS — render each character exactly as specified:',
          ...(input.characterDirections ?? []).map((c) => {
            const parts = [`${c.name}: expression — ${c.expression}`];
            if (c.position) parts.push(`frame position: ${c.position}`);
            if (c.expressionDetails?.eyes) parts.push(`eyes: ${c.expressionDetails.eyes}`);
            if (c.expressionDetails?.mouth) parts.push(`mouth: ${c.expressionDetails.mouth}`);
            if (c.expressionDetails?.eyebrows) parts.push(`eyebrows: ${c.expressionDetails.eyebrows}`);
            if (c.expressionDetails?.gaze) parts.push(`gaze: ${c.expressionDetails.gaze}`);
            if (c.expressionDetails?.headTilt) parts.push(`head tilt: ${c.expressionDetails.headTilt}`);
            if (c.pose) parts.push(`pose: ${c.pose}`);
            if (c.action) parts.push(`action: ${c.action}`);
            if (c.lookingAt) parts.push(`looking at: ${c.lookingAt}`);
            if (c.facingDirection) parts.push(`facing: ${c.facingDirection}`);
            if (c.gazeDirection) parts.push(`gaze direction: ${c.gazeDirection}`);
            if (c.mouthState) parts.push(`mouth state: ${c.mouthState}`);
            if (c.isSpeaking) parts.push('speaking now: mouth open naturally in mid-sentence, expression must match dialogue emotion');
            if (c.requiredVisibleFeatures?.length) parts.push(`must show clearly: ${c.requiredVisibleFeatures.join(', ')}`);
            if (c.reactionToScene) parts.push(`reaction: ${c.reactionToScene}`);
            return parts.join('; ');
          }),
        ].join('\n')
      : input.characters?.length
        ? [
            'CHARACTER DIRECTION FOR THIS SCENE:',
            ...input.characters.map(
              (c) => `${c.name}: ${c.expression ? `expression — ${c.expression}` : ''}${c.pose ? `${c.expression ? ', ' : ''}pose — ${c.pose}` : ''}`,
            ),
          ].join('\n')
        : '';

    const cameraLine = input.camera
      ? `CAMERA: ${input.camera}`
      : '';

    const faceVisibilityLine = [
      'FACE VISIBILITY: Keep the child\'s face clearly visible — prefer front or three-quarter angle.',
      'Avoid side profile, back view, extreme low/high camera angles, tiny distant faces, masks or helmets covering the face, and heavy dramatic shadows across the face.',
      'Show face and upper body large enough for identity checking; avoid hiding the mouth when the character is speaking.',
      'The hero\'s face must be recognisable in every panel.',
    ].join(' ');

    const identityBoostLine = input.identityBoostMode
      ? [
          'IDENTITY RECOVERY — the previous generation drifted from the approved child avatar.',
          'This time, preserve face identity MUCH more closely:',
          'exact face shape, exact hairstyle, exact skin tone, exact eye shape, same age, same smile, same distinctive features.',
          'Do NOT draw a generic cartoon child. Parents must instantly recognise their child in this illustration.',
        ].join(' ')
      : '';

    const styleDefault = input.style ?? 'premium semi-realistic children\'s storybook illustration, warm painterly lighting, expressive but identity-faithful faces, rich colorful backgrounds, Indian family warmth, no Pixar/anime/Disney facial exaggeration, no generic cartoon child';
    const stateBlock = input.storyStateBlock ?? storyStateLockLine;

    let prompt: string;
    if (dbImageTemplate) {
      // DB template is the source of truth — render exclusively, no blending
      prompt = [
        this.promptRegistry.renderPrompt(dbImageTemplate, {
          style: styleDefault,
          referenceOrderLine,
          heroIdentityLine,
          storyStateLockLine: stateBlock,
          castLine,
          characterDirectionLine,
          cameraLine,
          faceVisibilityLine,
          identityBoostLine,
          sceneDescription: input.sceneDescription,
        }),
        'RUNTIME IDENTITY LOCK: the approved avatar/reference is identity, not style. No generic cute child, no Pixar/anime/Disney face drift, no enlarged eyes, no rounded cheeks, no smaller nose, no changed smile, no changed skin tone, no changed hairstyle, no changed age. No text or speech bubbles in the image.',
      ].filter(Boolean).join('\n');
    } else {
      // Hardcoded fallback
      prompt = [
        styleDefault,
        referenceOrderLine,
        heroIdentityLine,
        stateBlock,
        castLine,
        characterDirectionLine,
        cameraLine,
        faceVisibilityLine,
        identityBoostLine,
        input.sceneDescription,
        'If the scene description conflicts with the reference portraits or identity descriptions, ignore the conflicting visual detail and follow the identity descriptions/reference portraits.',
        'IDENTITY LOCK: do not turn people into generic cartoon archetypes. Do not enlarge eyes, round cheeks, shrink the nose, alter the mouth/smile, change skin tone, change hairstyle, or change age. Do not add glasses, bindis, moustaches, jewellery, white hair, facial hair, or age changes unless the identity description or reference image has them.',
        'CAST LOCK: draw only the named characters required by the scene. Do not duplicate a child face for another child. Each named person must remain visually distinct and consistent across pages.',
        'Child-safe, joyful and adventurous atmosphere. NO text, NO words, NO letters, NO speech bubbles, NO captions, NO written dialogue anywhere in the image. Leave clean visual space where speech bubbles will be overlaid.',
      ].filter(Boolean).join('\n');
    }

    if (hasRef) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const edited = await (this.client.images.edit as any)({
          model: this.model,
          image: files,
          prompt,
          n: 1,
          size: '1024x1024',
          quality: imageQuality,
        });
        return this.fromImageResponse(edited);
      } catch (err) {
        this.logger.warn(
          `images.edit failed (${files.length} refs), falling back to generate: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        if (expectedRefs && !allowReferenceFallback) {
          throw err;
        }
      }
    }

    if (expectedRefs && !hasRef && !allowReferenceFallback) {
      throw new Error('Reference portraits could not be loaded; refusing to create generic story art.');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (this.client.images.generate as any)({
      model: this.model,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: imageQuality,
    });

    return this.fromImageResponse(response);
  }

  async describeCharacterAppearance(photoBuffer: Buffer, mimeType = 'image/png'): Promise<string | null> {
    try {
      const base64 = photoBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const visionPrompt = await this.renderRegistryPrompt(
        'character_vision',
        { imageUrl: 'attached image' },
        'Describe this person\'s appearance in one concise paragraph (60–90 words) for consistent storybook illustration. ' +
          'Cover: approximate age range, gender presentation if clear, face shape, skin tone, hair colour and style, eye shape, expression, build visible in the portrait, clothing, and distinctive features. ' +
          'Mention glasses, bindi, moustache, beard, jewellery, dimples, freckles, moles, braces, or saree ONLY if visibly present. If a feature is absent, say so for important traits like glasses or facial hair. ' +
          'Be specific and factual. Example: "A middle-aged Indian man with medium-brown skin, short black hair with a side part, dark eyes, a trimmed black moustache, a serious expression, and a white collared shirt. No glasses."',
      );
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            {
              type: 'text',
              text: visionPrompt,
            },
          ],
        }],
        max_tokens: 150,
      });
      const description = response.choices[0]?.message?.content?.trim() ?? null;
      if (description) this.logger.log(`Character appearance extracted: ${description.slice(0, 80)}…`);
      return description;
    } catch (err) {
      this.logger.warn(`describeCharacterAppearance failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async describeCharacterAppearanceFromUrl(url: string): Promise<string | null> {
    const loaded = await this.urlToBuffer(url);
    if (!loaded) return null;
    return this.describeCharacterAppearance(loaded.buffer, loaded.contentType);
  }

  async extractStructuredIdentity(description: string): Promise<CharacterIdentity | null> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: `Extract structured visual identity from this appearance description. Return ONLY valid JSON matching this exact schema:
{
  "faceShape": "oval/round/square/heart/etc or null",
  "skinTone": "specific description",
  "eyeShape": "almond/round/etc",
  "eyeColor": "colour",
  "hairstyle": "specific description",
  "hairColor": "specific colour",
  "hairLength": "short/medium/long/bald",
  "distinctiveFeatures": ["glasses", "dimples", etc — list only features visibly present],
  "neverChangeRules": [
    "Never change hairstyle",
    "Never change skin tone",
    "Never add glasses",
    "Never add beard or moustache",
    "Never change age",
    "Never change face shape"
  ]
}

Description to parse:
"${description}"`,
        }],
      });
      const content = response.choices[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content) as CharacterIdentity;
    } catch (err) {
      this.logger.warn(`extractStructuredIdentity failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async urlToFile(url: string, name: string): Promise<Awaited<ReturnType<typeof toFile>> | null> {
    // DiceBear returns SVGs — not accepted by images.edit, skip immediately
    if (url.includes('dicebear.com') || url.endsWith('.svg')) {
      this.logger.debug(`urlToFile skipped (DiceBear/SVG): ${url}`);
      return null;
    }

    try {
      const loaded = await this.urlToBuffer(url);
      if (!loaded) return null;
      const { buffer, contentType } = loaded;
      this.logger.debug(`urlToFile loaded ${buffer.length} bytes for ${name}`);
      return toFile(buffer, name, { type: contentType });
    } catch (err) {
      this.logger.warn(`urlToFile failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private async urlToBuffer(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const localPath = this.localUploadPathFromUrl(url);
    if (localPath) {
      try {
        const buffer = await readFile(localPath);
        return { buffer, contentType: this.contentTypeForPath(localPath) };
      } catch (err) {
        this.logger.warn(`local upload read failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        this.logger.warn(`urlToBuffer HTTP ${res.status} for ${url}`);
        return null;
      }
      const contentType = res.headers.get('content-type') ?? 'image/png';
      if (contentType.includes('svg')) {
        this.logger.warn(`urlToBuffer got SVG content-type for ${url}`);
        return null;
      }
      return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
    } catch (err) {
      this.logger.warn(`urlToBuffer failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private localUploadPathFromUrl(url: string): string | null {
    let pathname = url;
    try {
      pathname = new URL(url).pathname;
    } catch {
      // Keep relative paths as-is.
    }

    const marker = '/api/upload/files/';
    const index = pathname.indexOf(marker);
    if (index === -1) return null;

    const relative = pathname.slice(index + marker.length);
    const filename = basename(relative);
    if (!filename) return null;

    if (relative.startsWith('characters/')) return join(process.cwd(), 'uploads', 'characters', filename);
    if (relative.startsWith('stories/')) return join(process.cwd(), 'uploads', 'stories', filename);
    if (relative.startsWith('audio/') || relative.startsWith('videos/')) return null;
    return join(process.cwd(), 'uploads', 'avatars', filename);
  }

  private contentTypeForPath(path: string): string {
    const lower = path.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.heic')) return 'image/heic';
    return 'image/png';
  }

  async generateAvatar(input: AvatarGenerationInput): Promise<ImageGenerationOutput> {
    const adjustmentLine = input.adjustmentHint
      ? `Specific adjustment requested: ${input.adjustmentHint}`
      : '';

    // Read style rules from the prompt registry (avatar_generation key) so admins
    // can tune the avatar style without a deploy. Falls back to inline rules if not set.
    const registryRules = await this.getPromptTemplateText('avatar_generation');

    const prompt = [
      'Create a high-quality HeroKids storybook avatar portrait that looks almost identical to the reference photo.',
      'IDENTITY PRESERVATION IS THE TOP PRIORITY — the output must be instantly recognisable as the same person, just gently illustrated:',
      '• Keep the exact face shape, facial proportions, and bone structure.',
      '• Keep the exact skin tone and complexion.',
      '• Keep the exact hairstyle, hair colour, hair length, and hair texture — do not alter it in any way.',
      '• Keep the exact eye shape, eye colour, and gaze direction.',
      '• Keep the exact facial expression and emotion — if they are smiling, keep that smile; if they look serious, keep that.',
      '• Keep any distinctive features: glasses, freckles, dimples, moles, birthmarks, braces.',
      '• Keep the same age appearance.',
      'Allowed changes ONLY: replace the background with a clean soft-gradient or neutral studio background; apply subtle, flattering portrait lighting to make the subject look their best.',
      registryRules
        ? `ACTIVE PROMPT REGISTRY AVATAR RULES:\n${registryRules}`
        : 'Style: premium semi-realistic children\'s storybook portrait, warm painterly style with soft natural studio lighting. Avoid exaggerated Pixar or anime proportions — the child must look like an illustrated version of themselves, not a generic cartoon character. Indian family warmth.',
      'The result should feel ready to use as the character reference for future illustrated story pages. Avoid changing the nose, ears, jaw, smile, eyes, or hairline.',
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

  async checkFaceConsistencyFromUrl(
    heroAvatarUrl: string,
    generatedImageUrl: string,
    heroName: string,
  ): Promise<FaceConsistencyResult | null> {
    try {
      const loaded = await this.urlToBuffer(generatedImageUrl);
      if (!loaded) {
        this.logger.warn(`checkFaceConsistencyFromUrl: could not load generated image: ${generatedImageUrl}`);
        return null;
      }
      return this.checkFaceConsistency(heroAvatarUrl, loaded.buffer.toString('base64'), heroName);
    } catch (err) {
      this.logger.warn(`checkFaceConsistencyFromUrl failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async checkFaceConsistency(
    heroAvatarUrl: string,
    generatedImageBase64: string,
    heroName: string,
  ): Promise<FaceConsistencyResult | null> {
    try {
      const avatarData = await this.urlToBuffer(heroAvatarUrl);
      if (!avatarData) return null;

      const avatarDataUrl = `data:${avatarData.contentType};base64,${avatarData.buffer.toString('base64')}`;
      const generatedDataUrl = `data:image/png;base64,${generatedImageBase64}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: avatarDataUrl, detail: 'low' } },
            { type: 'image_url', image_url: { url: generatedDataUrl, detail: 'low' } },
            {
              type: 'text',
              text: await this.getIdentityQaPrompt(heroName),
            },
          ],
        }],
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) return null;

      const result = JSON.parse(content) as FaceConsistencyResult;
      this.logger.log(
        `Face QA [${heroName}]: score=${result.identityScore}/10 recommendation=${result.recommendation}` +
        (result.issues.length ? ` issues: ${result.issues.join(', ')}` : ''),
      );
      return result;
    } catch (err) {
      this.logger.warn(`checkFaceConsistency failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async locateSpeechBubbleAnchors(input: SpeechBubbleLayoutInput): Promise<SpeechBubbleLayoutResult | null> {
    if (!input.speechBubbles.length) return { bubbles: [] };

    try {
      let imageUrl = input.imageUrl;
      if (!imageUrl && input.imageBase64) {
        imageUrl = `data:image/png;base64,${input.imageBase64}`;
      }
      if (!imageUrl) return null;

      const prompt = [
        'You are a comic layout assistant. Inspect the story illustration and place speech bubbles.',
        'Return normalized percentage coordinates from 0 to 100 relative to the full image.',
        'For each requested bubble, find the speaker character and estimate the mouth or lower-face anchor point.',
        'Then choose a safe bubble rectangle that stays inside the image, is near the speaker, does not cover eyes/mouth/face/hands/main action, and has room for readable text.',
        'The bubble tail will be drawn by the app from the bubble edge to anchorPoint.',
        'If exact mouth is hard to see, use the lower-face/head center fallback and reduce confidence.',
        'Do not invent extra bubbles. Return one result per requested bubble in the same order.',
        '',
        `Page: ${input.pageNumber}`,
        input.sceneDescription ? `Scene: ${input.sceneDescription}` : '',
        `Character directions: ${JSON.stringify(input.characterDirections ?? [])}`,
        `Requested bubbles: ${JSON.stringify(input.speechBubbles)}`,
        '',
        'Return ONLY valid JSON:',
        '{"bubbles":[{"speakerName":"Name","text":"Line","anchorPoint":{"x":72,"y":46},"bubbleRect":{"x":8,"y":8,"width":36,"height":18},"confidence":0.86,"reason":"speaker on right, bubble placed upper left"}]}',
      ].filter(Boolean).join('\n');

      const response = await this.client.chat.completions.create({
        model: this.config.get<string>('OPENAI_VISION_LAYOUT_MODEL') ?? 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            { type: 'text', text: prompt },
          ],
        }],
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) return null;

      const parsed = JSON.parse(content) as SpeechBubbleLayoutResult;
      const clamp = (value: unknown, min: number, max: number, fallback: number) => {
        const n = Number(value);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
      };

      return {
        bubbles: (parsed.bubbles ?? []).slice(0, input.speechBubbles.length).map((bubble, index) => ({
          speakerName: bubble.speakerName || input.speechBubbles[index]?.speakerName || '',
          text: bubble.text || input.speechBubbles[index]?.text || '',
          anchorPoint: {
            x: clamp(bubble.anchorPoint?.x, 3, 97, 50),
            y: clamp(bubble.anchorPoint?.y, 3, 97, 50),
          },
          bubbleRect: {
            x: clamp(bubble.bubbleRect?.x, 2, 82, 8),
            y: clamp(bubble.bubbleRect?.y, 2, 82, 8),
            width: clamp(bubble.bubbleRect?.width, 24, 48, 36),
            height: clamp(bubble.bubbleRect?.height, 10, 28, 16),
          },
          confidence: clamp(bubble.confidence, 0, 1, 0.5),
          reason: bubble.reason,
        })),
      };
    } catch (err) {
      this.logger.warn(`locateSpeechBubbleAnchors failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
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

import {
  BadRequestException,
  Global,
  Injectable,
  Logger,
  Module,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { Repository } from 'typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { AiUsageRecorder, aiUsageContext } from './ai-usage-recorder.service';
import { AiOperation } from './entities/ai-usage-log.entity';

/** Thrown when generated content (story text or a picture) fails the child-safety check. */
export class ContentSafetyError extends Error {
  constructor(public readonly reason: string) {
    super(`CONTENT_SAFETY: ${reason}`);
    this.name = 'ContentSafetyError';
  }
}

export function isContentSafetyError(err: unknown): boolean {
  return (
    err instanceof ContentSafetyError ||
    (err instanceof Error && err.message.startsWith('CONTENT_SAFETY'))
  );
}

export interface SafetyVerdict {
  safe: boolean;
  /** Plain-English categories that tripped, e.g. ["sexual content"]. Never contains the text itself. */
  reasons: string[];
}

/** What the reviewer may report; mild adventure peril is explicitly allowed. */
const CATEGORY_LABELS: Record<string, string> = {
  sexual: 'sexual content',
  nudity: 'nudity',
  graphic_violence: 'graphic violence',
  death_or_injury: 'death or injury',
  weapons_harm: 'weapons used on someone',
  self_harm: 'self-harm',
  drugs_alcohol_smoking: 'drugs, alcohol or smoking',
  hate_or_discrimination: 'hateful content',
  profanity: 'rude language',
  horror: 'frightening content',
  romance: 'romance',
  dangerous_acts: 'dangerous acts',
};

const REVIEW_RULES = `You are a strict child-safety reviewer for an Indian storybook app read by children aged 4–12.
Decide whether the CONTENT is suitable. Mild adventure peril is SAFE: a villain, a chase, a storm, a maze, a trick,
a villain being trapped, outsmarted or running away, a sword cutting vines, a shield blocking, a grumpy creature.
UNSAFE is anything with: sexual content or innuendo, nudity or undress, graphic violence, blood or wounds, death or
killing (of anyone, including villains and animals), weapons used to hurt someone, self-harm, drugs, alcohol or smoking,
hate, insults or discrimination (caste, religion, skin colour, gender, disability), swear words in any language
(English, Hindi, Hinglish), horror meant to frighten, romance or kissing, or dangerous acts a child could copy.
For text a parent typed (a story idea, a name, a costume), judge whether it ASKS for unsafe content.
Ordinary fairy-tale conflict in a parent's idea is SAFE — fighting a dragon, battling a monster, a sword fight,
defeating or capturing a villain, a superhero saving the day — because the writer turns it into a gentle story.
Only flag a parent's idea if it asks for gore, graphic or realistic killing, sexual content, cruelty, hate,
insults or mocking anyone's looks, body, caste, religion, skin colour or disability (e.g. "fat", "ugly", "stupid"),
swearing, drugs/alcohol/smoking, self-harm, or real-world violence.
Reply with JSON only: {"safe": true|false, "categories": [...]} using categories from:
${Object.keys(CATEGORY_LABELS).join(', ')}.`;

/**
 * Words that never belong in a children's story, in English and Hinglish. Matched as whole words,
 * so "skill" or "Essex" don't trip. Everyday words that only sound rude are left out on purpose
 * ("kutta" = dog, "gore" = fair-skinned, "weed" in a garden). Kept short on purpose: the moderation model does the real
 * judgement; this list catches the obvious cases even when that service is unavailable.
 */
const BLOCKED_WORDS = [
  // sexual
  'sex',
  'sexy',
  'sexual',
  'nude',
  'nudes',
  'naked',
  'nsfw',
  'porn',
  'porno',
  'pornography',
  'xxx',
  'boobs',
  'tits',
  'penis',
  'vagina',
  'condom',
  'erotic',
  'orgasm',
  'horny',
  'hentai',
  'striptease',
  'stripper',
  'rape',
  'raped',
  'molest',
  'molested',
  // self-harm & drugs & alcohol
  'suicide',
  'suicidal',
  'self-harm',
  'cocaine',
  'heroin',
  'meth',
  'ganja',
  'charas',
  'daaru',
  'sharab',
  'whisky',
  'whiskey',
  'vodka',
  'beer',
  'drunk',
  'cigarette',
  'cigarettes',
  'beedi',
  // gore
  'gory',
  'behead',
  'beheaded',
  'decapitate',
  'decapitated',
  'dismember',
  'dismembered',
  'torture',
  'tortured',
  'corpse',
  // profanity (English)
  'fuck',
  'fucking',
  'fucker',
  'shit',
  'bitch',
  'bastard',
  'asshole',
  'slut',
  'whore',
  'cunt',
  // profanity (Hindi / Hinglish)
  'chutiya',
  'chutiye',
  'bhenchod',
  'behenchod',
  'bhenchodd',
  'madarchod',
  'maderchod',
  'gaand',
  'gandu',
  'lund',
  'lauda',
  'loda',
  'randi',
  'bhosdi',
  'bhosdike',
  'bhosadike',
  'harami',
  'kutiya',
];
export const BLOCKED_PATTERN = new RegExp(
  `(^|[^\\p{L}\\p{N}])(${BLOCKED_WORDS.join('|')})(?=$|[^\\p{L}\\p{N}])`,
  'iu',
);

/**
 * Child-safety checks for everything parents type, every photo they upload, and everything the AI
 * writes or draws. Uses a fixed word list plus a strict Gemini review (SAFETY_CHECK_MODEL).
 * If the moderation service is down, typed text still goes through the word list and generated
 * content still has the providers' own (strict) filters — it never blocks the whole product.
 */
@Injectable()
export class ContentSafetyService {
  private readonly logger = new Logger(ContentSafetyService.name);
  private client: GoogleGenerativeAI | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
    private readonly usage: AiUsageRecorder,
  ) {}

  /** Throws a friendly 400 if any field a parent typed isn't suitable for a children's story. */
  async assertSafeInput(
    fields: Record<string, string | null | undefined>,
    userId?: string,
  ): Promise<void> {
    const entries = Object.entries(fields).filter(
      (e): e is [string, string] => typeof e[1] === 'string' && !!e[1].trim(),
    );
    if (!entries.length || !(await this.isEnabled())) return;

    for (const [field, value] of entries) {
      if (BLOCKED_PATTERN.test(value)) {
        this.logger.warn(
          `Blocked input (word list) user=${userId ?? '-'} field=${field}`,
        );
        throw this.inputError(field);
      }
    }
    // Log the review against this parent (outside story generation there's no usage context yet).
    const verdict = await aiUsageContext.run(
      { ...(aiUsageContext.getStore() ?? {}), userId },
      () => this.moderateText(entries.map(([, v]) => v).join('\n'), 'input'),
    );
    if (!verdict.safe) {
      this.logger.warn(
        `Blocked input (moderation) user=${userId ?? '-'} fields=${entries.map(([f]) => f).join(',')} reasons=${verdict.reasons.join(',')}`,
      );
      throw this.inputError(entries.length === 1 ? entries[0][0] : null);
    }
  }

  /** Rejects an uploaded photo that isn't a normal family picture. */
  async assertSafePhoto(
    photo: { buffer: Buffer; mimetype?: string },
    userId?: string,
  ): Promise<void> {
    if (!(await this.isEnabled())) return;
    const verdict = await aiUsageContext.run(
      { ...(aiUsageContext.getStore() ?? {}), userId },
      () => this.moderateImage(photo.buffer.toString('base64'), photo.mimetype),
    );
    if (!verdict.safe) {
      this.logger.warn(
        `Blocked photo upload user=${userId ?? '-'} reasons=${verdict.reasons.join(',')}`,
      );
      throw new BadRequestException(
        "This photo can't be used. Please upload a clear, everyday photo of the person's face.",
      );
    }
  }

  async checkStoryText(text: string): Promise<SafetyVerdict> {
    if (!(await this.isEnabled())) return { safe: true, reasons: [] };
    if (BLOCKED_PATTERN.test(text))
      return { safe: false, reasons: ['blocked words'] };
    return this.moderateText(text, 'story');
  }

  async checkImage(
    base64: string,
    mimeType = 'image/png',
  ): Promise<SafetyVerdict> {
    if (!(await this.isEnabled())) return { safe: true, reasons: [] };
    return this.moderateImage(base64, mimeType);
  }

  private async moderateText(
    text: string,
    kind: 'input' | 'story',
  ): Promise<SafetyVerdict> {
    const label =
      kind === 'input'
        ? 'TEXT A PARENT TYPED'
        : 'STORY TEXT AND PICTURE DESCRIPTIONS';
    return this.review(
      [
        {
          text: `${REVIEW_RULES}\n\nCONTENT (${label}):\n${text.slice(0, 30_000)}`,
        },
      ],
      kind,
    );
  }

  private async moderateImage(
    base64: string,
    mimeType = 'image/png',
  ): Promise<SafetyVerdict> {
    return this.review(
      [
        {
          text: `${REVIEW_RULES}\n\nCONTENT: the attached picture. Judge only what is visible.`,
        },
        { inlineData: { mimeType: mimeType || 'image/png', data: base64 } },
      ],
      'image',
    );
  }

  /**
   * Asks Gemini (JSON mode, temperature 0) for a verdict. If Gemini's own filters refuse to even look,
   * that is itself a sign the content is unsafe. If the service is down we let it through (typed text has
   * already passed the word list; generated content was made under strict provider filters).
   */
  private async review(parts: Part[], kind: string): Promise<SafetyVerdict> {
    const genAI = this.getClient();
    if (!genAI) return { safe: true, reasons: [] };
    try {
      const modelName = await this.reviewModel();
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
      });
      const response = result.response;
      void this.usage.record({
        provider: 'gemini',
        model: modelName,
        operation: AiOperation.SafetyCheck,
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
      });
      if (
        response.promptFeedback?.blockReason ||
        ['SAFETY', 'PROHIBITED_CONTENT', 'IMAGE_SAFETY'].includes(
          String(response.candidates?.[0]?.finishReason),
        )
      ) {
        return { safe: false, reasons: ['blocked by provider safety filters'] };
      }
      const parsed = JSON.parse(response.text()) as {
        safe?: boolean;
        categories?: string[];
      };
      const reasons = (parsed.categories ?? []).map(
        (c) => CATEGORY_LABELS[c] ?? c,
      );
      return parsed.safe === false || reasons.length
        ? {
            safe: false,
            reasons: reasons.length ? reasons : ['unsafe content'],
          }
        : { safe: true, reasons: [] };
    } catch (err) {
      this.logger.warn(
        `Safety review unavailable (${kind}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return { safe: true, reasons: [] };
    }
  }

  private async reviewModel(): Promise<string> {
    const row = await this.settingsRepo
      .findOne({ where: { key: 'SAFETY_CHECK_MODEL' } })
      .catch(() => null);
    return row?.value?.trim() || 'gemini-3.8-flash';
  }

  private inputError(field: string | null) {
    const where = field ? ` in "${FIELD_LABELS[field] ?? field}"` : '';
    return new BadRequestException(
      `Please keep it child-friendly — something${where} isn't suitable for a children's story. Try rewording it.`,
    );
  }

  private getClient(): GoogleGenerativeAI | null {
    if (this.client) return this.client;
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) return null;
    this.client = new GoogleGenerativeAI(apiKey);
    return this.client;
  }

  private async isEnabled(): Promise<boolean> {
    const row = await this.settingsRepo
      .findOne({ where: { key: 'CONTENT_SAFETY_ENABLED' } })
      .catch(() => null);
    return (row?.value ?? 'true') !== 'false';
  }
}

const FIELD_LABELS: Record<string, string> = {
  storyContext: 'story idea',
  companionName: 'companion name',
  name: 'name',
  heroTitle: 'hero title',
  tagline: 'tagline',
  relationship: 'relationship',
  role: 'role',
  costumeDescription: 'costume',
  adjustmentHint: 'avatar instructions',
  hairDescription: 'hair',
  faceDescription: 'face',
  accessories: 'accessories',
  colors: 'colours',
  doNotChangeRules: 'rules',
  eyeDescription: 'eyes',
  skinTone: 'skin tone',
};

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PlatformSetting])],
  providers: [ContentSafetyService],
  exports: [ContentSafetyService],
})
export class ContentSafetyModule {}

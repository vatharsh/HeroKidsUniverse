import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IMAGE_GENERATION_PROVIDER } from '../ai/interfaces/image-generation.provider';
import type { ImageGenerationProvider } from '../ai/interfaces/image-generation.provider';
import { PromptRegistryService } from '../ai/prompt-registry.service';
import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { UniverseCompanion } from '../companions/entities/universe-companion.entity';
import { Hero } from '../heroes/hero.entity';
import { Universe } from '../universes/universe.entity';
import { Character } from './entities/character.entity';
import {
  CanonGeneratedFrom,
  CanonType,
  CharacterCanon,
} from './entities/character-canon.entity';

type BackfillResult = {
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  missingAvatar: number;
  alreadyComplete: number;
};

@Injectable()
export class CharacterCanonService {
  private readonly logger = new Logger(CharacterCanonService.name);

  constructor(
    @InjectRepository(CharacterCanon) private readonly canonRepo: Repository<CharacterCanon>,
    @InjectRepository(Hero) private readonly heroesRepo: Repository<Hero>,
    @InjectRepository(Character) private readonly charactersRepo: Repository<Character>,
    @InjectRepository(UniverseCompanion) private readonly companionsRepo: Repository<UniverseCompanion>,
    @Inject(IMAGE_GENERATION_PROVIDER) private readonly imageProvider: ImageGenerationProvider,
    @Optional() private readonly promptRegistry: PromptRegistryService | null,
    @InjectRepository(PlatformSetting) private readonly settingsRepo: Repository<PlatformSetting>,
  ) {}

  private async getMinQualityScore(): Promise<number> {
    const row = await this.settingsRepo.findOne({ where: { key: 'CHARACTER_CANON_MIN_QUALITY' } });
    const val = Number(row?.value ?? SETTING_DEFAULTS['CHARACTER_CANON_MIN_QUALITY']?.value ?? '70');
    return Number.isFinite(val) ? val : 70;
  }

  async generateCanonFromAvatar(params: {
    heroId?: string;
    characterId?: string;
    companionId?: string;
    userId: string;
    avatarUrl: string;
    canonType: CanonType;
    generatedFrom?: CanonGeneratedFrom;
  }): Promise<CharacterCanon> {
    const canon = await this.canonRepo.save(
      this.canonRepo.create({
        heroId: params.heroId ?? null,
        characterId: params.characterId ?? null,
        companionId: params.companionId ?? null,
        userId: params.userId,
        canonType: params.canonType,
        approvedAvatarUrl: params.avatarUrl,
        status: 'pending',
        generatedFrom: params.generatedFrom ?? 'approved_avatar',
      }),
    );

    try {
      const rawDescription = await this.imageProvider.describeCharacterAppearanceFromUrl(params.avatarUrl);
      if (!rawDescription) {
        canon.status = 'failed';
        canon.errorMessage = 'Vision analysis returned null';
        return await this.canonRepo.save(canon);
      }

      const client = (this.imageProvider as any).client;
      if (!client) {
        throw new Error('OpenAI client unavailable on image provider');
      }

      const model = 'gpt-4o-mini';
      const canonPrompt = await this.getCharacterCanonPrompt(rawDescription);
      const response = await client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: canonPrompt,
        }],
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Canon extraction returned empty response');
      }

      const parsed = JSON.parse(content) as {
        identityJson: CharacterCanon['identityJson'];
        appearanceSummary: string;
        neverChangeRules: string[];
        distinctiveFeatures: string[];
        faceMetrics: CharacterCanon['faceMetricsJson'];
        qualityScore: number;
      };

      canon.identityJson = parsed.identityJson ?? null;
      canon.appearanceSummary = parsed.appearanceSummary ?? null;
      canon.neverChangeRulesJson = parsed.neverChangeRules ?? null;
      canon.distinctiveFeaturesJson = parsed.distinctiveFeatures ?? null;
      canon.faceMetricsJson = parsed.faceMetrics ?? null;
      canon.qualityScore = parsed.qualityScore ?? null;
      const minQuality = await this.getMinQualityScore();
      canon.status = (parsed.qualityScore ?? 0) >= minQuality ? 'complete' : 'needs_review';
      canon.generationModel = model;
      canon.errorMessage = null;
      return await this.canonRepo.save(canon);
    } catch (error) {
      canon.status = 'failed';
      canon.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.canonRepo.save(canon);
      throw error;
    }
  }

  private async getCharacterCanonPrompt(rawDescription: string): Promise<string> {
    const fallback = `You are analyzing a children's storybook avatar to extract a detailed character canon for consistent future illustration.

Avatar description: "${rawDescription}"

Return ONLY valid JSON matching this exact structure (no markdown):
{
  "identityJson": {
    "approximate_age_range": "e.g. 7-9 years",
    "gender_presentation_if_clear": "boy/girl/unclear",
    "skin_tone": "e.g. warm medium brown",
    "face_shape": "e.g. round with soft cheeks",
    "facial_proportions": "e.g. wide forehead, compact lower face",
    "eye_shape": "e.g. almond-shaped",
    "eye_color_if_clear": "e.g. dark brown or null",
    "eyebrow_shape": "e.g. naturally arched",
    "nose_shape": "e.g. small button nose",
    "mouth_shape": "e.g. medium width",
    "smile_description": "e.g. wide smile",
    "cheek_description": "e.g. round full cheeks",
    "jawline_description": "e.g. soft rounded jawline",
    "ear_visibility": "e.g. partially visible",
    "hairstyle": "e.g. short straight black hair with fringe",
    "hair_color": "e.g. very dark brown/black",
    "hair_length": "e.g. short",
    "hair_texture": "e.g. straight",
    "build_visible": "e.g. slim or null",
    "expression_default": "e.g. cheerful and bright",
    "glasses": false,
    "facial_hair": false,
    "jewellery": null,
    "bindi": false,
    "freckles": false,
    "moles": null,
    "dimples": false,
    "braces": false,
    "other_distinctive_features": [],
    "visual_rules": {
      "must_preserve": ["face shape", "skin tone", "hairstyle", "hair color", "eye shape", "smile", "age appearance"],
      "must_not_add": ["glasses", "facial hair", "bindi", "jewellery", "different hairstyle", "different skin tone"],
      "must_not_change": ["face shape", "skin tone", "hairstyle", "age appearance"],
      "acceptable_variations": ["clothing", "lighting", "background", "facial expression within age-appropriate range"]
    }
  },
  "appearanceSummary": "One dense paragraph (60-90 words) for a storybook illustrator.",
  "neverChangeRules": ["Never change the child's hairstyle.", "Never change the skin tone.", "Never change the face shape.", "Never make the child look older or younger.", "Never make the character look like a generic cartoon child."],
  "distinctiveFeatures": [],
  "faceMetrics": {
    "face_width_category": "medium",
    "face_length_category": "medium",
    "eye_size_category": "medium",
    "eye_spacing_category": "medium",
    "nose_size_category": "medium",
    "mouth_width_category": "medium",
    "cheek_fullness_category": "medium",
    "chin_shape": "round",
    "forehead_visibility": "medium",
    "overall_face_silhouette": "round"
  },
  "qualityScore": 85
}`;

    try {
      const version = this.promptRegistry ? await this.promptRegistry.getActivePrompt('character_canon') : null;
      return version?.promptText && this.promptRegistry
        ? this.promptRegistry.renderPrompt(version.promptText, { avatarDescription: rawDescription })
        : fallback;
    } catch (error) {
      this.logger.warn(`Prompt registry character_canon fallback: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }

  async ensureCanonExists(params: {
    heroId?: string;
    characterId?: string;
    companionId?: string;
    userId: string;
    avatarUrl: string | null;
    canonType: CanonType;
  }): Promise<CharacterCanon | null> {
    const where = params.heroId
      ? { heroId: params.heroId, status: 'complete' as const }
      : params.characterId
        ? { characterId: params.characterId, status: 'complete' as const }
        : params.companionId
          ? { companionId: params.companionId, status: 'complete' as const }
          : undefined;

    const existing = await this.canonRepo.findOne({ where });
    if (existing) return existing;

    if (!params.avatarUrl) {
      this.logger.warn(`Missing avatar URL for canon generation (${params.canonType})`);
      return null;
    }

    try {
      return await this.generateCanonFromAvatar({
        heroId: params.heroId,
        characterId: params.characterId,
        companionId: params.companionId,
        userId: params.userId,
        avatarUrl: params.avatarUrl,
        canonType: params.canonType,
      });
    } catch (error) {
      this.logger.warn(
        `Canon generation failed for ${params.canonType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  getCanonForHero(heroId: string): Promise<CharacterCanon | null> {
    return this.canonRepo.findOne({ where: { heroId } });
  }

  getCanonForCharacter(characterId: string): Promise<CharacterCanon | null> {
    return this.canonRepo.findOne({ where: { characterId } });
  }

  getCanonForCompanion(companionId: string): Promise<CharacterCanon | null> {
    return this.canonRepo.findOne({ where: { companionId } });
  }

  async regenerateCanon(canonId: string): Promise<CharacterCanon> {
    const existing = await this.canonRepo.findOneOrFail({ where: { id: canonId } });
    const regenerated = await this.generateCanonFromAvatar({
      heroId: existing.heroId ?? undefined,
      characterId: existing.characterId ?? undefined,
      companionId: existing.companionId ?? undefined,
      userId: existing.userId,
      avatarUrl: existing.approvedAvatarUrl ?? '',
      canonType: existing.canonType,
      generatedFrom: existing.generatedFrom,
    });
    regenerated.generationVersion = existing.generationVersion + 1;
    return this.canonRepo.save(regenerated);
  }

  async backfillAll(): Promise<BackfillResult> {
    const [heroes, characters, companions] = await Promise.all([
      this.heroesRepo.find({ select: ['id', 'userId', 'avatarUrl'] }),
      this.charactersRepo.find({ select: ['id', 'userId', 'avatarUrl', 'role'] }),
      this.companionsRepo.find({ select: ['id', 'universeId', 'avatarUrl', 'petCharacterId'] }),
    ]);

    const result: BackfillResult = {
      total: heroes.length + characters.length + companions.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      missingAvatar: 0,
      alreadyComplete: 0,
    };

    for (const hero of heroes) {
      const existing = await this.canonRepo.findOne({ where: { heroId: hero.id, status: 'complete' } });
      if (existing) {
        result.alreadyComplete++;
        result.skipped++;
        continue;
      }
      if (!hero.avatarUrl) {
        result.missingAvatar++;
        result.skipped++;
        continue;
      }
      const canon = await this.ensureCanonExists({
        heroId: hero.id,
        userId: hero.userId,
        avatarUrl: hero.avatarUrl,
        canonType: 'hero',
      });
      canon ? result.processed++ : result.failed++;
    }

    for (const character of characters) {
      const existing = await this.canonRepo.findOne({ where: { characterId: character.id, status: 'complete' } });
      if (existing) {
        result.alreadyComplete++;
        result.skipped++;
        continue;
      }
      if (!character.avatarUrl) {
        result.missingAvatar++;
        result.skipped++;
        continue;
      }
      const canon = await this.ensureCanonExists({
        characterId: character.id,
        userId: character.userId,
        avatarUrl: character.avatarUrl,
        canonType: character.role === 'pet' ? 'pet' : 'supporting_character',
      });
      canon ? result.processed++ : result.failed++;
    }

    for (const companion of companions) {
      const existing = await this.canonRepo.findOne({ where: { companionId: companion.id, status: 'complete' } });
      if (existing) {
        result.alreadyComplete++;
        result.skipped++;
        continue;
      }
      if (!companion.avatarUrl) {
        result.missingAvatar++;
        result.skipped++;
        continue;
      }
      const universe = await this.companionsRepo.manager.getRepository(Universe).findOne({
        where: { id: companion.universeId },
        select: ['id', 'userId'],
      });
      if (!universe) {
        result.failed++;
        continue;
      }
      const canon = await this.ensureCanonExists({
        companionId: companion.id,
        userId: universe.userId,
        avatarUrl: companion.avatarUrl,
        canonType: 'companion',
      });
      canon ? result.processed++ : result.failed++;
    }

    this.logger.log(`Character canon backfill complete: ${JSON.stringify(result)}`);
    return result;
  }

  async listCanons(params: {
    status?: string;
    canonType?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Array<Record<string, unknown>>; total: number }> {
    const page = Math.max(1, params.page);
    const limit = Math.max(1, Math.min(100, params.limit));
    const qb = this.canonRepo.createQueryBuilder('canon').where('canon.deletedAt IS NULL');

    if (params.status) qb.andWhere('canon.status = :status', { status: params.status });
    if (params.canonType) qb.andWhere('canon.canonType = :canonType', { canonType: params.canonType });

    qb.orderBy('canon.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    const heroIds = rows.map((row) => row.heroId).filter((id): id is string => !!id);
    const characterIds = rows.map((row) => row.characterId).filter((id): id is string => !!id);
    const companionIds = rows.map((row) => row.companionId).filter((id): id is string => !!id);

    const [heroes, characters, companions] = await Promise.all([
      heroIds.length ? this.heroesRepo.find({ where: heroIds.map((id) => ({ id })), select: ['id', 'name'] }) : [],
      characterIds.length ? this.charactersRepo.find({ where: characterIds.map((id) => ({ id })), select: ['id', 'name'] }) : [],
      companionIds.length ? this.companionsRepo.find({ where: companionIds.map((id) => ({ id })), select: ['id', 'name'] }) : [],
    ]);

    const heroMap = new Map(heroes.map((hero) => [hero.id, hero.name ?? 'Hero']));
    const characterMap = new Map(characters.map((character) => [character.id, character.name]));
    const companionMap = new Map(companions.map((companion) => [companion.id, companion.name]));

    return {
      data: rows.map((row) => ({
        id: row.id,
        canonType: row.canonType,
        status: row.status,
        qualityScore: row.qualityScore,
        approvedAvatarUrl: row.approvedAvatarUrl,
        appearanceSummary: row.appearanceSummary,
        generationVersion: row.generationVersion,
        entityName: row.heroId
          ? heroMap.get(row.heroId)
          : row.characterId
            ? characterMap.get(row.characterId)
            : companionMap.get(row.companionId ?? '') ?? 'Unknown',
        userId: row.userId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
    };
  }
}

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AiOperation, AiUsageLog } from '../ai/entities/ai-usage-log.entity';
import { StoryGenerationCost } from '../ai/entities/story-generation-cost.entity';
import { StoryGenerationLog } from '../ai/entities/story-generation-log.entity';
import { IMAGE_GENERATION_PROVIDER } from '../ai/interfaces/image-generation.provider';
import { NARRATION_PROVIDER } from '../ai/interfaces/narration.provider';
import { STORY_GENERATION_PROVIDER } from '../ai/interfaces/story-generation.provider';
import type { ImageGenerationInput, ImageGenerationProvider } from '../ai/interfaces/image-generation.provider';
import type { NarrationProvider } from '../ai/interfaces/narration.provider';
import type {
  PageCharacter,
  PageDialogue,
  SceneOutput,
  SpeechBubbleMetadata,
  SpeechBubbleStyle,
  StoryGenerationOutput,
  StoryGenerationProvider,
  UniverseContext,
} from '../ai/interfaces/story-generation.provider';
import { AIQualityAssuranceService } from '../ai/ai-quality-assurance.service';
import { BACKGROUND_SCENE_STYLE, STORYBOOK_STYLE } from '../ai/style.constants';
import { CharacterCanonService } from '../characters/character-canon.service';
import type { FaceMetricsJson } from '../characters/entities/character-canon.entity';
import { Character } from '../characters/entities/character.entity';
import { CharacterVisualProfile } from '../characters/entities/character-visual-profile.entity';
import { UniverseCompanion } from '../companions/entities/universe-companion.entity';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { Hero } from '../heroes/hero.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { UniverseVillain, VillainStatus } from '../universes/universe-villain.entity';
import { pickStoryShape } from './story-shapes';
import { Quest, QuestStatus } from '../quests/quest.entity';
import { Story, StoryMode, StoryPage, StoryScene, StoryStatus, StoryTheme, StoryVisualState } from '../stories/story.entity';
import { ArcStatus, StoryArc } from '../story-arcs/story-arc.entity';
import { MemoryType, UniverseMemory } from '../universes/universe-memory.entity';
import { Universe } from '../universes/universe.entity';
import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { User } from '../users/user.entity';
import { UploadService } from '../upload/upload.service';
import { CastMember, GeminiCharacterLocator } from '../ai/providers/gemini-character-locator.service';
import { wavToMp3 } from './audio-compress';
import { layoutBubbles } from './bubble-layout';
import { GenerationJob, JobStatus } from './generation-job.entity';

const THEME_LABELS: Record<StoryTheme, string> = {
  [StoryTheme.SpaceAdventure]: 'an exciting space adventure with rockets, planets, and alien friends',
  [StoryTheme.SuperheroMission]: 'a superhero mission to save the city using special powers',
  [StoryTheme.JungleQuest]: 'a jungle quest discovering hidden temples and friendly animals',
  [StoryTheme.UnderwaterAdventure]: 'an underwater adventure exploring coral reefs and meeting sea creatures',
  [StoryTheme.DetectiveMystery]: 'a detective mystery solving clues around the neighbourhood',
  [StoryTheme.BirthdayAdventure]: 'a magical birthday adventure where every wish comes true',
};

class StoryStateTracker {
  location: string | null;
  costume: string | null;
  items: Set<string>;
  powers: Set<string>;
  companions: Set<string>;
  weapon: string | null;

  constructor(initialState: StoryVisualState | null) {
    this.location = initialState?.currentLocation ?? null;
    this.costume = initialState?.costume ?? null;
    this.items = new Set(initialState?.inventory ?? []);
    this.powers = new Set(initialState?.powers ?? []);
    this.companions = initialState?.companion ? new Set([initialState.companion]) : new Set();
    this.weapon = initialState?.weapon ?? null;
  }

  applyUpdate(update: {
    newItems?: string[];
    removedItems?: string[];
    newPowers?: string[];
    removedPowers?: string[];
    newCompanions?: string[];
    removedCompanions?: string[];
    locationChange?: string | null;
    costumeChange?: string | null;
  } | undefined): void {
    if (!update) return;
    update.newItems?.forEach((i) => this.items.add(i));
    update.removedItems?.forEach((i) => this.items.delete(i));
    update.newPowers?.forEach((p) => this.powers.add(p));
    update.removedPowers?.forEach((p) => this.powers.delete(p));
    update.newCompanions?.forEach((c) => this.companions.add(c));
    update.removedCompanions?.forEach((c) => this.companions.delete(c));
    if (update.locationChange) this.location = update.locationChange;
    if (update.costumeChange) this.costume = update.costumeChange;
  }

  toStateSnapshot(): { location?: string; costume?: string; items: string[]; powers: string[]; companions: string[] } {
    return {
      ...(this.location ? { location: this.location } : {}),
      ...(this.costume ? { costume: this.costume } : {}),
      items: Array.from(this.items),
      powers: Array.from(this.powers),
      companions: Array.from(this.companions),
    };
  }

  toImageStateBlock(): string {
    const lines: string[] = ['CURRENT STORY STATE (DO NOT CHANGE unless scene explicitly changes it):'];
    if (this.costume) lines.push(`Hero costume: ${this.costume}`);
    if (this.weapon) lines.push(`Hero weapon/item: ${this.weapon}`);
    if (this.items.size) lines.push(`Hero carries: ${Array.from(this.items).join(', ')}`);
    if (this.powers.size) lines.push(`Active powers (show visual effect): ${Array.from(this.powers).join(', ')}`);
    if (this.companions.size) lines.push(`Companions visible: ${Array.from(this.companions).join(', ')}`);
    if (this.location) lines.push(`Current location: ${this.location}`);
    return lines.join('\n');
  }
}

@Injectable()
export class GenerationService implements OnModuleInit {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(STORY_GENERATION_PROVIDER) private readonly storyProvider: StoryGenerationProvider,
    @Inject(IMAGE_GENERATION_PROVIDER) private readonly imageProvider: ImageGenerationProvider,
    @Inject(NARRATION_PROVIDER) private readonly narrationProvider: NarrationProvider,
    private readonly uploadService: UploadService,
    private readonly characterCanonService: CharacterCanonService,
    private readonly qaService: AIQualityAssuranceService,
    @InjectRepository(Story) private readonly storiesRepo: Repository<Story>,
    @InjectRepository(Hero) private readonly heroesRepo: Repository<Hero>,
    @InjectRepository(Universe) private readonly universesRepo: Repository<Universe>,
    @InjectRepository(UniverseMemory) private readonly memoriesRepo: Repository<UniverseMemory>,
    @InjectRepository(HeroPower) private readonly powersRepo: Repository<HeroPower>,
    @InjectRepository(Quest) private readonly questsRepo: Repository<Quest>,
    @InjectRepository(UniverseVillain) private readonly villainsRepo: Repository<UniverseVillain>,
    @InjectRepository(Character) private readonly charactersRepo: Repository<Character>,
    @InjectRepository(CharacterVisualProfile) private readonly visualProfilesRepo: Repository<CharacterVisualProfile>,
    @InjectRepository(UniverseCompanion) private readonly companionsRepo: Repository<UniverseCompanion>,
    @InjectRepository(AiUsageLog) private readonly aiUsageLogsRepo: Repository<AiUsageLog>,
    @InjectRepository(StoryGenerationLog) private readonly storyGenerationLogsRepo: Repository<StoryGenerationLog>,
    @InjectRepository(StoryGenerationCost) private readonly storyGenerationCostsRepo: Repository<StoryGenerationCost>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(StoryArc) private readonly storyArcsRepo: Repository<StoryArc>,
    @InjectRepository(CreditTransaction) private readonly creditsRepo: Repository<CreditTransaction>,
    @InjectRepository(GenerationJob) private readonly jobsRepo: Repository<GenerationJob>,
    @InjectRepository(PlatformSetting) private readonly platformSettingsRepo: Repository<PlatformSetting>,
    private readonly characterLocator: GeminiCharacterLocator,
  ) {}

  async onModuleInit() {
    try {
      const setting = await this.platformSettingsRepo.findOne({ where: { key: 'SANDBOX_MODE' } });
      const isSandbox = setting ? setting.value === 'true' : true;
      if (isSandbox) {
        const [logsResult, costsResult] = await Promise.all([
          this.aiUsageLogsRepo
            .createQueryBuilder()
            .update()
            .set({ isSandbox: true })
            .where('isSandbox = false')
            .execute(),
          this.storyGenerationCostsRepo
            .createQueryBuilder()
            .update()
            .set({ isSandbox: true })
            .where('isSandbox = false')
            .execute(),
        ]);
        const total = (logsResult.affected ?? 0) + (costsResult.affected ?? 0);
        if (total > 0) {
          this.logger.log(`Backfilled ${logsResult.affected} ai_usage_logs + ${costsResult.affected} story_generation_costs to isSandbox=true`);
        }
      }
    } catch (err) {
      this.logger.warn('AI isSandbox backfill skipped', err);
    }

    // Rescue stories stuck in-progress from a prior process crash
    try {
      const stuckCutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      const stuckStories = await this.storiesRepo.find({
        where: [
          { status: StoryStatus.GeneratingStory },
          { status: StoryStatus.GeneratingImages },
          { status: StoryStatus.GeneratingAudio },
        ],
      });
      const zombies = stuckStories.filter((s) => s.updatedAt < stuckCutoff);
      if (zombies.length > 0) {
        await Promise.all(
          zombies.map(async (s) => {
            const errorMsg = 'Generation timed out — server restarted mid-generation. Please retry.';
            await this.storiesRepo.update(s.id, { status: StoryStatus.Failed, errorMessage: errorMsg });
            // Also close any open generation jobs so the frontend stops showing a progress bar
            await this.jobsRepo
              .createQueryBuilder()
              .update()
              .set({ status: JobStatus.Failed, currentStep: 'Failed', errorMessage: errorMsg, completedAt: new Date() })
              .where('"storyId" = :id AND status NOT IN (:...done)', { id: s.id, done: [JobStatus.Completed, JobStatus.Failed] })
              .execute();
            await this.refundStoryCharge(s);
          }),
        );
        this.logger.warn(`Rescued ${zombies.length} zombie story/stories on startup (marked failed, credits refunded)`);
      }
    } catch (err) {
      this.logger.warn('Zombie story rescue skipped', err);
    }
  }

  async generateStory(storyId: string, userId: string): Promise<void> {
    const job = await this.jobsRepo.save(
      this.jobsRepo.create({ userId, storyId, status: JobStatus.Queued, progressPercentage: 0 }),
    );

    const updateJob = (patch: Partial<GenerationJob>) => this.jobsRepo.update(job.id, patch);

    try {
      const isSandbox = await this.getBooleanSetting('SANDBOX_MODE', true);

      // Daily AI hard-limit guard — only enforced in live mode to avoid blocking dev work
      if (!isSandbox) {
        const dailyHardLimit = await this.getNumberSetting('AI_DAILY_COST_HARD_LIMIT_USD', 25);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const costRow = await this.aiUsageLogsRepo
          .createQueryBuilder('log')
          .select('COALESCE(SUM(log.estimatedCostUsd), 0)', 'total')
          .where('log.createdAt >= :start AND log.isSandbox = false', { start: todayStart })
          .getRawOne<{ total: string }>();
        const aiCostToday = Number(costRow?.total ?? 0);
        if (aiCostToday >= dailyHardLimit) {
          this.logger.error(
            `AI_DAILY_COST_HARD_LIMIT_USD exceeded: $${aiCostToday.toFixed(4)} >= $${dailyHardLimit} — blocking generation for story ${storyId}`,
          );
          await updateJob({
            status: JobStatus.Failed,
            errorMessage: `Daily AI cost limit ($${dailyHardLimit} USD) exceeded. Generation blocked by admin safety guard. Current spend: $${aiCostToday.toFixed(2)}.`,
            completedAt: new Date(),
          });
          return;
        }
      }

      await updateJob({
        status: JobStatus.GeneratingStory,
        currentStep: 'Generating Story',
        progressPercentage: 5,
        startedAt: new Date(),
      });

      const story = await this.storiesRepo.findOne({ where: { id: storyId, userId } });
      if (!story) return;

      await updateJob({ universeId: story.universeId });

      const hero = await this.heroesRepo.findOne({ where: { id: story.heroId } });
      if (!hero) return;

      const universeContext = story.universeId ? await this.buildUniverseContext(story) : undefined;
      const isStandalone = story.storyMode === StoryMode.Standalone;

      let existingVisualState: StoryVisualState | null = null;
      if (story.universeId && !isStandalone && story.storyMode !== StoryMode.NewAdventure) {
        const prevStory = await this.storiesRepo.findOne({
          where: { universeId: story.universeId, status: StoryStatus.Completed },
          order: { createdAt: 'DESC' },
        });
        existingVisualState = prevStory?.storyVisualState ?? null;

        if (!existingVisualState && universeContext?.visualState) {
          existingVisualState = {
            costume: universeContext.visualState.costume,
            companion: universeContext.visualState.companion,
            weapon: universeContext.visualState.weapon,
            powers: universeContext.heroPowers ?? [],
            inventory: universeContext.heroPowers ?? [],
            transformation: null,
          };
        }

        // Seed hero costume from hero profile if no prior story established one
        if (existingVisualState && !existingVisualState.costume && hero.costumeDescription) {
          existingVisualState.costume = hero.costumeDescription;
        } else if (!existingVisualState && hero.costumeDescription) {
          existingVisualState = {
            costume: hero.costumeDescription,
            companion: null,
            weapon: null,
            powers: universeContext?.heroPowers ?? [],
            inventory: [],
            transformation: null,
          };
        }
      }

      // Strip companion from visual state when user opted out for this episode
      if (story.skipCompanion && existingVisualState) {
        existingVisualState = { ...existingVisualState, companion: null };
      }

      const companionLabel = (universeContext?.companion && !story.skipCompanion)
        ? `${universeContext.companion.name} (${universeContext.companion.type} companion)`
        : null;
      await this.ensureHeroAvatarDescription(hero);
      await this.ensureHeroCharacterIdentity(hero);
      const canonEnabled = await this.getBooleanSetting('CHARACTER_CANON_ENABLED', true);
      const heroCanon = canonEnabled
        ? await this.characterCanonService.ensureCanonExists({
            heroId: hero.id,
            userId: hero.userId,
            avatarUrl: hero.avatarUrl,
            canonType: 'hero',
          }).catch(() => null)
        : null;
      const supportingChars = await this.buildSupportingCharacterContext(story);
      const supportingCharLabels = supportingChars.map((c) => c.label);
      if (companionLabel) supportingCharLabels.push(companionLabel);
      const supportingCharAvatars = supportingChars.map((c) => c.avatarUrl).filter((u): u is string => !!u);
      const supportingCharDescriptions = supportingChars.map((c) => c.avatarDescription ?? '');
      const supportingCharAges: (number | null)[] = supportingChars.map((c) => c.age);
      const characterCanonData = canonEnabled
        ? await this.buildCharacterCanonData(story, supportingChars)
        : { summaries: supportingChars.map((c) => c.avatarDescription ?? ''), neverChangeRules: supportingChars.map(() => null) };
      const characterCanonSummaries = characterCanonData.summaries;
      const characterNeverChangeRules = characterCanonData.neverChangeRules;
      const characterBibles = await this.buildCharacterBibles(supportingChars);

      const heroAge = this.computeAge(hero.dob);
      const heroName = hero.name ?? 'Hero';
      const heroGender = hero.gender ?? 'child';

      const storyUser = await this.usersRepo.findOne({ where: { id: userId } });
      const pageCount = story.isPreview
        ? await this.getNumberSetting('FREE_PREVIEW_PAGES', Number(SETTING_DEFAULTS.FREE_PREVIEW_PAGES.value))
        : await this.getPlanPageCount(storyUser?.plan ?? 'basic');

      const themeDescription = story.theme
        ? (THEME_LABELS[story.theme] ?? 'an exciting adventure')
        : (story.storyContext
            ? `a custom adventure described by the user: "${story.storyContext}"`
            : 'a fun and creative adventure chosen by the storyteller');

      await this.storiesRepo.update(storyId, { status: StoryStatus.GeneratingStory });

      const generated = await this.storyProvider.generateStory({
        heroName,
        heroAge,
        heroGender,
        heroVisualDescription: hero.avatarDescription ?? undefined,
        themeDescription,
        pageCount,
        supportingCharacters: supportingCharLabels,
        supportingCharacterVisualDescriptions: supportingCharDescriptions,
        universeContext: (universeContext && story.skipCompanion)
          ? { ...universeContext, companion: null }
          : universeContext,
        storyContext: story.storyContext ?? undefined,
        storyVisualState: existingVisualState,
      });
      const normalizedGenerated = this.normalizeGeneratedStory(generated, heroName, existingVisualState);
      // In universe stories the writer often calls the hero by their title ("Commander") — make that the hero,
      // otherwise the title becomes a separate invented person in sheets, pictures and bubbles.
      this.normalizeHeroAliases(normalizedGenerated, heroName, universeContext?.heroTitle ?? null);

      // Build per-character outfit lock from user-authored visual profiles
      const characterOutfits: Record<string, string> = {};
      for (const sc of supportingChars) {
        if (!sc.characterId) continue;
        const bible = characterBibles[supportingChars.indexOf(sc)];
        const wears = bible.match(/ALWAYS WEARS: ([^\n]+)/)?.[1]?.trim();
        if (wears) characterOutfits[sc.label.split('(')[0].trim()] = wears;
      }

      // hero.costumeDescription is the canonical source — always wins over whatever Gemini describes.
      // Gemini's storyVisualState.costume reflects what it thinks the hero is wearing (often casual),
      // which must NOT override the user-authored costume. Only allow Gemini's value as a last resort.
      // Standalone stories don't use the universe costume, but still need ONE locked outfit — the writer's.
      const effectiveCostume = isStandalone
        ? (normalizedGenerated.storyVisualState?.costume || null)
        : (hero.costumeDescription || existingVisualState?.costume || normalizedGenerated.storyVisualState?.costume || null);
      // Writer-designed outfit for every other character. Parents often put accessories or age in the
      // "outfit" field ("rectangular glasses"), so keep their note AND the writer's actual outfit.
      for (const [name, outfit] of Object.entries(normalizedGenerated.storyVisualState?.characterOutfits ?? {})) {
        if (!outfit) continue;
        const parentNote = characterOutfits[name];
        characterOutfits[name] = parentNote && !parentNote.toLowerCase().includes(outfit.toLowerCase())
          ? `${outfit}; always with: ${parentNote}`
          : outfit;
      }

      let storyVisualState: StoryVisualState | null = null;
      if (normalizedGenerated.storyVisualState) {
        storyVisualState = {
          costume: effectiveCostume,
          companion: normalizedGenerated.storyVisualState.companion,
          weapon: normalizedGenerated.storyVisualState.weapon,
          powers: normalizedGenerated.storyVisualState.powers ?? [],
          inventory: normalizedGenerated.storyVisualState.inventory ?? [],
          transformation: null,
          characterOutfits: Object.keys(characterOutfits).length ? characterOutfits : undefined,
          characterLooks: normalizedGenerated.storyVisualState.characterLooks,
        };
      } else if (universeContext) {
        storyVisualState = {
          costume: effectiveCostume,
          companion: (universeContext.companion && !story.skipCompanion) ? `${universeContext.companion.name} (${universeContext.companion.type})` : null,
          weapon: universeContext.visualState?.weapon ?? null,
          powers: universeContext.heroPowers ?? [],
          inventory: universeContext.heroPowers ?? [],
          transformation: null,
          characterOutfits: Object.keys(characterOutfits).length ? characterOutfits : undefined,
        };
      } else if (Object.keys(characterOutfits).length || existingVisualState) {
        storyVisualState = {
          costume: effectiveCostume,
          companion: existingVisualState?.companion ?? null,
          weapon: existingVisualState?.weapon ?? null,
          powers: existingVisualState?.powers ?? [],
          inventory: existingVisualState?.inventory ?? [],
          transformation: null,
          characterOutfits: Object.keys(characterOutfits).length ? characterOutfits : existingVisualState?.characterOutfits,
        };
      }

      if (storyVisualState && universeContext) {
        // A returning villain must look exactly like last time, whatever the writer described.
        const returning = universeContext.returningVillain;
        if (returning?.look) {
          storyVisualState.characterLooks = { ...(storyVisualState.characterLooks ?? {}), [returning.name]: returning.look };
        }
        if (universeContext.storyShape) storyVisualState.storyShape = universeContext.storyShape.key;
        const villainName = normalizedGenerated.villain?.name?.trim() || returning?.name;
        if (villainName) storyVisualState.villainName = villainName;
      }

      if (storyVisualState) {
        await this.storiesRepo.update(storyId, { storyVisualState });
      }

      // Persist established costume back to universe so subsequent stories inherit it.
      // Always update if hero.costumeDescription changed — user-authored value always wins.
      if (!isStandalone && story.universeId && storyVisualState?.costume) {
        const universe = await this.universesRepo.findOne({ where: { id: story.universeId } });
        const costumeChanged = hero.costumeDescription && universe?.visualState?.costume !== hero.costumeDescription;
        if (universe && (!universe.visualState?.costume || costumeChanged)) {
          const updatedVisualState = { ...(universe.visualState ?? {}), costume: storyVisualState.costume };
          await this.universesRepo.update(story.universeId, { visualState: updatedVisualState as typeof universe.visualState });
        }
      }

      const storyCostUsd = await this.logStoryGeneration(storyId, userId, story.universeId ?? null, normalizedGenerated, isSandbox);

      let arcId: string | null = null;
      if (story.universeId) {
        if (story.storyMode === StoryMode.NewArc) {
          const arc = await this.storyArcsRepo.save(
            this.storyArcsRepo.create({ universeId: story.universeId, title: normalizedGenerated.title, summary: null }),
          );
          arcId = arc.id;
        } else if (story.storyMode === StoryMode.ContinueArc) {
          const activeArc = await this.storyArcsRepo.findOne({
            where: { universeId: story.universeId, status: ArcStatus.Active },
            order: { createdAt: 'DESC' },
          });
          if (activeArc) arcId = activeArc.id;
        }
      }

      await updateJob({
        status: JobStatus.GeneratingImages,
        currentStep: 'Generating Illustrations',
        progressPercentage: 20,
      });
      await this.storiesRepo.update(storyId, { status: StoryStatus.GeneratingImages });
      const sceneGenerationEnabled = await this.getBooleanSetting('ENABLE_SCENE_GENERATION', true);
      const useSceneGeneration =
        sceneGenerationEnabled &&
        Array.isArray(normalizedGenerated.scenes) &&
        normalizedGenerated.scenes.length > 0;

      let pagesWithImages: StoryPage[];
      let totalImageCostUsd: number;
      let generatedScenes: StoryScene[] | null = null;

      if (useSceneGeneration) {
        const sceneResult = await this.generateSceneImages(
          story,
          hero,
          heroName,
          heroAge,
          normalizedGenerated,
          supportingCharLabels,
          supportingCharAvatars,
          supportingCharDescriptions,
          isSandbox,
          storyVisualState,
          heroCanon?.appearanceSummary ?? undefined,
          heroCanon?.neverChangeRulesJson ?? undefined,
          heroCanon?.faceMetricsJson ? this.buildFaceMetricsSummary(heroCanon.faceMetricsJson) : undefined,
          characterCanonSummaries,
          characterNeverChangeRules,
          characterBibles,
          supportingCharAges,
          async (sceneNum, total) => {
            await updateJob({
              currentStep: `Generating Illustrations (scene ${sceneNum}/${total})`,
              progressPercentage: 20 + Math.round((60 * sceneNum) / total),
            });
          },
        );
        pagesWithImages = sceneResult.pages;
        totalImageCostUsd = sceneResult.totalCostUsd;
        generatedScenes = sceneResult.scenes;
        if (sceneResult.castSheets && storyVisualState) {
          storyVisualState = { ...storyVisualState, castSheets: sceneResult.castSheets, castSheetKeys: sceneResult.castSheetKeys };
        }
        this.logger.log(
          `Story ${storyId}: scene-based generation — ${sceneResult.scenes.length} scenes, ${pagesWithImages.length} pages, ${totalImageCostUsd.toFixed(4)} USD`,
        );
      } else {
        const pageResult = await this.generatePageImages(
          story,
          hero,
          heroName,
          heroAge,
          normalizedGenerated,
          supportingCharLabels,
          supportingCharAvatars,
          supportingCharDescriptions,
          isSandbox,
          storyVisualState,
          heroCanon?.appearanceSummary ?? undefined,
          heroCanon?.neverChangeRulesJson ?? undefined,
          heroCanon?.faceMetricsJson ? this.buildFaceMetricsSummary(heroCanon.faceMetricsJson) : undefined,
          characterCanonSummaries,
          characterNeverChangeRules,
          characterBibles,
          supportingCharAges,
          async (pageNum, total) => {
            await updateJob({
              currentStep: `Generating Illustrations (${pageNum}/${total})`,
              progressPercentage: 20 + Math.round((60 * pageNum) / total),
            });
          },
        );
        pagesWithImages = pageResult.pages;
        totalImageCostUsd = pageResult.totalCostUsd;
      }

      const narrationEnabled = await this.getBooleanSetting('ENABLE_NARRATION', true);
      let pages = pagesWithImages;
      let totalAudioCostUsd = 0;

      if (narrationEnabled) {
        await updateJob({
          status: JobStatus.GeneratingAudio,
          currentStep: 'Generating Narration',
          progressPercentage: 82,
        });
        await this.storiesRepo.update(storyId, { status: StoryStatus.GeneratingAudio });

        const audioResult = await this.generatePageAudio(story, pagesWithImages, isSandbox);
        pages = audioResult.pages;
        totalAudioCostUsd = audioResult.totalCostUsd;
      }

      // AI Quality Assurance Engine (Milestone 3)
      const qaEnabled = await this.getBooleanSetting('QA_ENABLED', true);
      if (qaEnabled) {
        this.logger.log(`QA enabled — running on story ${storyId} (${pages.length} pages)`);
        try {
          await updateJob({ currentStep: 'AI Quality Review', progressPercentage: 93 });
          const qaResult = await this.qaService.runStoryQA({
            story,
            hero,
            heroCanon,
            pages,
            storyVisualState,
            imageGenerationInput: {
              heroName,
              heroAge,
              heroAvatarUrl: hero.avatarUrl ?? undefined,
              heroAvatarDescription: hero.avatarDescription ?? undefined,
              heroCanonSummary: heroCanon?.appearanceSummary ?? undefined,
              heroNeverChangeRules: heroCanon?.neverChangeRulesJson ?? undefined,
              storyVisualState: storyVisualState ?? undefined,
            },
          });
          pages = qaResult.finalPages;
          this.logger.log(
            `QA complete for story ${storyId}: confidence=${qaResult.overallConfidence} status=${qaResult.overallStatus} retried=${qaResult.pagesRetried}`,
          );
        } catch (err) {
          this.logger.error(
            `QA engine FAILED for story ${storyId} (non-fatal, story will complete): ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err.stack : undefined,
          );
          // Mark story overallConfidence as 0 so dashboard shows QA did not complete
          await this.storiesRepo.update(storyId, { overallConfidence: 0 }).catch(() => {});
        }
      } else {
        this.logger.log(`QA disabled for story ${storyId}`);
      }

      const destination = story.universeId ? 'Saving Story to Universe' : 'Saving Story as Standalone Adventure';
      await updateJob({ status: JobStatus.SavingMemory, currentStep: destination, progressPercentage: 95 });

      await this.storiesRepo.update(storyId, {
        status: StoryStatus.Completed,
        title: normalizedGenerated.title || `${heroName}'s Adventure`,
        pages,
        scenes: generatedScenes,
        coverImageUrl: generatedScenes?.[0]?.illustrationUrl ?? pages[0]?.imageUrl ?? null,
        cliffhanger: normalizedGenerated.cliffhanger ?? null,
        arcId,
        storyVisualState,
      });

      await this.persistUniverseExtracts(story, normalizedGenerated);
      await this.storyGenerationCostsRepo.save(
        this.storyGenerationCostsRepo.create({
          storyId,
          userId: story.userId,
          storyCostUsd,
          imageCostUsd: totalImageCostUsd,
          audioCostUsd: totalAudioCostUsd,
          totalCostUsd: storyCostUsd + totalImageCostUsd + totalAudioCostUsd,
          isSandbox,
        }),
      );

      await updateJob({
        status: JobStatus.Completed,
        currentStep: 'Completed',
        progressPercentage: 100,
        completedAt: new Date(),
      });
      this.logger.log(`Story ${storyId} generated successfully`);
    } catch (err) {
      this.logger.error(`Story ${storyId} generation failed`, err);
      const msg = err instanceof Error ? err.message : 'Unknown error';

      await this.storiesRepo.update(storyId, { status: StoryStatus.Failed, errorMessage: msg });
      await updateJob({
        status: JobStatus.Failed,
        currentStep: 'Failed',
        errorMessage: msg,
        completedAt: new Date(),
      });

      try {
        const failedStory = await this.storiesRepo.findOne({ where: { id: storyId } });
        if (failedStory) await this.refundStoryCharge(failedStory);
      } catch (refundErr) {
        this.logger.error(`Credit refund failed for user ${userId}, story ${storyId}`, refundErr);
      }
    }
  }

  async getActiveJobs(userId: string): Promise<GenerationJob[]> {
    return this.jobsRepo
      .createQueryBuilder('job')
      .innerJoin('stories', 's', 's.id = job."storyId"')
      .where('job."userId" = :userId', { userId })
      .orderBy('job."createdAt"', 'DESC')
      .limit(20)
      .getMany();
  }

  async deleteJobsByStoryId(storyId: string): Promise<void> {
    await this.jobsRepo.delete({ storyId });
  }

  private async generatePageImages(
    story: Story,
    hero: Hero,
    heroName: string,
    heroAge: number,
    generated: StoryGenerationOutput,
    supportingCharacters: string[],
    characterAvatarUrls: string[],
    characterAvatarDescriptions: string[],
    isSandbox: boolean,
    storyVisualState: StoryVisualState | null,
    heroCanonSummary?: string,
    heroNeverChangeRules?: string[],
    heroFaceMetrics?: string,
    characterCanonSummaries?: string[],
    characterNeverChangeRules?: (string[] | null)[],
    characterBibles?: string[],
    supportingCharAges?: (number | null)[],
    onPageDone?: (pageNum: number, total: number) => Promise<void>,
  ): Promise<{ pages: StoryPage[]; totalCostUsd: number }> {
    const mode = await this.getStringSetting('IMAGE_GENERATION_MODE', 'full_generation');
    const imageQuality = await this.getStringSetting('OPENAI_IMAGE_QUALITY', 'medium');
    const allowReferenceless = await this.getBooleanSetting('OPENAI_IMAGE_ALLOW_REFERENCELESS_FALLBACK', false);
    const pages: StoryPage[] = [];
    const total = generated.pages.length;
    let totalCostUsd = 0;

    if (mode === 'avatar_only') {
      const avatarUrl = hero.avatarUrl ?? undefined;
      return {
        pages: generated.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
          narrationText: page.narrationText,
          imageUrl: avatarUrl,
          audioUrl: undefined,
          sceneDescription: page.sceneDescription,
          dialogue: page.dialogue,
          characters: page.characters,
          camera: page.camera,
          cropHint: page.cropHint,
          sceneId: page.sceneId,
          background: page.background,
          speechBubbles: page.speechBubbles ?? [],
          characterDirections: page.characterDirections ?? [],
          storyStateUpdate: page.storyStateUpdate,
        })),
        totalCostUsd: 0,
      };
    }

    const isBackgroundOnly = mode === 'background_only';

    let maxImages: number;
    if (mode === 'story_only') {
      maxImages = 0;
    } else if (mode === 'story_plus_cover') {
      maxImages = 1;
    } else if (mode === 'story_cover_first_two_pages') {
      maxImages = 3;
    } else {
      const capKey: keyof typeof SETTING_DEFAULTS = isSandbox ? 'MAX_IMAGES_PER_STORY_DEV' : 'MAX_IMAGES_PER_STORY_PROD';
      maxImages = await this.getNumberSetting(capKey, Number(SETTING_DEFAULTS[capKey].value));
      if (maxImages < total) {
        this.logger.warn(
          `${capKey} is ${maxImages}, but full_generation was requested for ${total} pages. Generating all pages.`,
        );
        maxImages = total;
      }
    }

    const { imageBackend, imageProvider, imageModel, costPerImage } = await this.resolveImageModelCost();
    const faceQAEnabled = await this.getBooleanSetting('FACE_CONSISTENCY_QA_ENABLED', true);
    const faceQAThreshold = await this.getNumberSetting('FACE_CONSISTENCY_THRESHOLD', 7);
    const ageQAEnabled = await this.getBooleanSetting('APPARENT_AGE_QA_ENABLED', true);
    const ageQATolerance = await this.getNumberSetting('APPARENT_AGE_TOLERANCE', 3);
    const ageQARetryCap = await this.getNumberSetting('APPARENT_AGE_RETRY_CAP', 2);
    const childCostumeRewriteEnabled = await this.getBooleanSetting('CHILD_COSTUME_REWRITE_ENABLED', true);
    const childCostumeThreshold = await this.getNumberSetting('CHILD_COSTUME_REWRITE_AGE_THRESHOLD', 13);
    const costumedCanonicalEnabled = await this.getBooleanSetting('ENABLE_COSTUMED_CANONICAL', false);

    // Change 4: rewrite adult-coded costume language for child characters
    const effectiveVisualState: typeof storyVisualState = (storyVisualState && childCostumeRewriteEnabled)
      ? {
          ...storyVisualState,
          costume: (storyVisualState.costume && heroAge < childCostumeThreshold)
            ? this.rewriteChildCostume(storyVisualState.costume, heroAge)
            : storyVisualState.costume,
        }
      : storyVisualState;

    // Change 5: build child-character list for apparent-age QA
    const ageQAChildChars = [
      ...(heroAge < 18 ? [{ name: heroName, canonAge: heroAge, description: hero.avatarDescription ?? undefined }] : []),
      ...(supportingCharAges ?? []).flatMap((age, i) => {
        if (!age || age >= 18) return [];
        const name = supportingCharacters[i]?.split('(')[0].trim() ?? `Character ${i + 1}`;
        return [{ name, canonAge: age, description: characterAvatarDescriptions[i] ?? undefined }];
      }),
    ];

    // Change 7: costumed canonical pre-step (behind ENABLE_COSTUMED_CANONICAL flag)
    let effectiveHeroAvatarUrl = hero.avatarUrl;
    let effectiveCharAvatarUrls = [...characterAvatarUrls];
    if (costumedCanonicalEnabled && !isBackgroundOnly) {
      if (hero.avatarUrl && heroAge < 18 && effectiveVisualState?.costume) {
        try {
          const canonical = await this.imageProvider.generateCostumedCanonical({
            characterName: heroName,
            age: heroAge,
            costumeDescription: effectiveVisualState.costume,
            avatarUrl: hero.avatarUrl,
            canonSummary: heroCanonSummary,
            quality: imageQuality,
          });
          if (canonical.imageUrl) {
            effectiveHeroAvatarUrl = canonical.imageUrl;
            this.logger.log(`Costumed canonical generated for hero ${heroName}`);
          }
        } catch (err) {
          this.logger.warn(`Costumed canonical failed for hero: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      for (let i = 0; i < characterAvatarUrls.length; i++) {
        const charAge = supportingCharAges?.[i];
        if (!charAge || charAge >= 18 || !characterAvatarUrls[i]) continue;
        const charName = supportingCharacters[i]?.split('(')[0].trim();
        const charCostume = effectiveVisualState?.characterOutfits?.[charName ?? ''];
        if (!charCostume || !charName) continue;
        try {
          const canonical = await this.imageProvider.generateCostumedCanonical({
            characterName: charName,
            age: charAge,
            costumeDescription: charCostume,
            avatarUrl: characterAvatarUrls[i],
            canonSummary: characterCanonSummaries?.[i],
            quality: imageQuality,
          });
          if (canonical.imageUrl) {
            effectiveCharAvatarUrls[i] = canonical.imageUrl;
            this.logger.log(`Costumed canonical generated for ${charName}`);
          }
        } catch (err) {
          this.logger.warn(`Costumed canonical failed for ${charName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Supporting char info for Change 3 (age prefix in scene descriptions)
    const supportingCharInfoForAgePrefix = supportingCharacters.map((label, i) => ({
      name: label.split('(')[0].trim(),
      age: supportingCharAges?.[i] ?? null,
    }));

    // Separate pages that get illustrations from those that don't (beyond maxImages cap)
    const illustratedPages = generated.pages.slice(0, maxImages);
    const remainingPages   = generated.pages.slice(maxImages);
    const { pageStateBlockMap, pageStateSnapshotMap } = this.precomputePageStateMaps(generated.pages, storyVisualState);

    // Track settled count for live progress updates
    let settled = 0;

    type PageResult = { page: (typeof illustratedPages)[0]; imageOutput: import('../ai/interfaces/image-generation.provider').ImageGenerationOutput | null; error?: string };

    // Keep concurrency small: identity references are more reliable and OpenAI rate limits are less likely.
    const generationResults: PageResult[] = await this.mapWithConcurrency(
      illustratedPages,
      2,
      async (page): Promise<PageResult> => {
        try {
          const imageInput: ImageGenerationInput = {
            // Change 3: embed hero+character ages in scene description's first mention of each name
            sceneDescription: this.prefixAgesInSceneDescription(
              page.sceneDescription, heroName, heroAge, supportingCharInfoForAgePrefix,
            ),
            heroName,
            heroAge,
            supportingCharacters,
            heroAvatarUrl: effectiveHeroAvatarUrl ?? undefined,
            heroAvatarDescription: hero.avatarDescription ?? undefined,
            characterAvatarUrls: effectiveCharAvatarUrls,
            characterAvatarDescriptions,
            style: isBackgroundOnly ? BACKGROUND_SCENE_STYLE : STORYBOOK_STYLE,
            storyVisualState: effectiveVisualState ?? undefined,
            dialogue: page.dialogue,
            characters: page.characters,
            camera: page.camera,
            heroCanonSummary,
            heroNeverChangeRules,
            heroFaceMetrics,
            characterCanonSummaries,
            characterNeverChangeRules,
            characterBibles,
            supportingCharacterAges: supportingCharAges ?? undefined,
            storyStateBlock: pageStateBlockMap.get(page.pageNumber) ?? undefined,
            characterDirections: page.characterDirections,
            backgroundOnlyMode: isBackgroundOnly,
            quality: imageQuality,
            allowReferenceless,
          };
          let imageOutput = await this.generateImageWithRetry(imageInput);

          if (!isBackgroundOnly && faceQAEnabled && hero.avatarUrl && imageOutput.imageBase64) {
            const qaResult = await this.imageProvider.checkFaceConsistency(
              hero.avatarUrl, imageOutput.imageBase64, heroName,
            ).catch(() => null);
            if (qaResult && qaResult.identityScore < faceQAThreshold) {
              this.logger.warn(
                `Face QA page ${page.pageNumber}: score=${qaResult.identityScore}/${faceQAThreshold} — regenerating with identity boost`,
              );
              try {
                imageOutput = await this.generateImageWithRetry({ ...imageInput, identityBoostMode: true });
              } catch {
                this.logger.warn(`Identity boost regeneration failed for page ${page.pageNumber}, using original`);
              }
            }
          }

          // Change 5: apparent-age QA gate — separate from face-consistency score
          if (!isBackgroundOnly && ageQAEnabled && ageQAChildChars.length > 0 && imageOutput.imageBase64) {
            const ageResult = await this.imageProvider.checkApparentAge({
              imageBase64: imageOutput.imageBase64,
              characters: ageQAChildChars,
            }).catch(() => null);
            if (ageResult) {
              const hasDrift = ageResult.estimates.some(
                (e) => Math.abs(e.estimatedAge - e.canonAge) > ageQATolerance,
              );
              if (hasDrift) {
                this.logger.warn(
                  `Age QA page ${page.pageNumber}: drift — ${ageResult.estimates
                    .map((e) => `${e.name} canon=${e.canonAge} est=${e.estimatedAge}`).join(', ')}`,
                );
                for (let attempt = 0; attempt < ageQARetryCap; attempt++) {
                  try {
                    const retryOutput = await this.generateImageWithRetry({ ...imageInput, identityBoostMode: true });
                    const retryCheck = retryOutput.imageBase64
                      ? await this.imageProvider.checkApparentAge({
                          imageBase64: retryOutput.imageBase64, characters: ageQAChildChars,
                        }).catch(() => null)
                      : null;
                    const stillDrift = retryCheck?.estimates.some(
                      (e) => Math.abs(e.estimatedAge - e.canonAge) > ageQATolerance,
                    ) ?? true;
                    if (!stillDrift) { imageOutput = retryOutput; break; }
                  } catch { break; }
                }
              }
            }
          }

          settled++;
          if (onPageDone) await onPageDone(settled, illustratedPages.length).catch(() => {});
          return { page, imageOutput };
        } catch (err) {
          settled++;
          if (onPageDone) await onPageDone(settled, illustratedPages.length).catch(() => {});
          return { page, imageOutput: null, error: err instanceof Error ? err.message : 'Unknown' };
        }
      },
    );

    // Upload results sequentially (upload is fast; generation was the bottleneck)
    for (const { page, imageOutput, error } of generationResults) {
      if (!imageOutput) {
        this.logger.warn(`Image gen failed for story ${story.id}, page ${page.pageNumber}: ${error ?? 'Unknown'}`);
        pages.push({
          pageNumber: page.pageNumber,
          text: page.text,
          narrationText: page.narrationText,
          imageUrl: undefined,
          audioUrl: undefined,
          sceneDescription: page.sceneDescription,
          dialogue: page.dialogue,
          characters: page.characters,
          camera: page.camera,
          cropHint: page.cropHint,
          sceneId: page.sceneId,
          background: page.background,
          speechBubbles: page.speechBubbles,
          storyStateSnapshot: pageStateSnapshotMap.get(page.pageNumber),
          characterDirections: page.characterDirections,
          storyStateUpdate: page.storyStateUpdate,
        });
        continue;
      }

      let imageUrl: string | undefined;
      try {
        imageUrl = imageOutput.imageBase64
          ? await this.uploadService.uploadGeneratedImage(story.userId, story.id, page.pageNumber, imageOutput.imageBase64)
          : imageOutput.imageUrl || undefined;

        totalCostUsd += costPerImage;
        await this.aiUsageLogsRepo.save(
          this.aiUsageLogsRepo.create({
            userId: story.userId,
            storyId: story.id,
            universeId: story.universeId ?? null,
            provider: imageProvider,
            model: imageModel,
            operation: AiOperation.ImageGeneration,
            imagesGenerated: 1,
            estimatedCostUsd: costPerImage,
            isSandbox,
          }),
        );
      } catch (uploadErr) {
        this.logger.warn(
          `Image upload failed for story ${story.id}, page ${page.pageNumber}: ${
            uploadErr instanceof Error ? uploadErr.message : 'Unknown'
          }`,
        );
      }
      pages.push({
        pageNumber: page.pageNumber,
        text: page.text,
        narrationText: page.narrationText,
        imageUrl: isBackgroundOnly ? undefined : imageUrl,
        backgroundUrl: isBackgroundOnly ? imageUrl : undefined,
        audioUrl: undefined,
        sceneDescription: page.sceneDescription,
        dialogue: page.dialogue,
        characters: page.characters,
        camera: page.camera,
        cropHint: page.cropHint,
        sceneId: page.sceneId,
        background: page.background,
        speechBubbles: page.speechBubbles,
        storyStateSnapshot: pageStateSnapshotMap.get(page.pageNumber),
        characterDirections: page.characterDirections,
        storyStateUpdate: page.storyStateUpdate,
      });
    }

    // Pages beyond maxImages get no illustration
    for (const page of remainingPages) {
      pages.push({
        pageNumber: page.pageNumber,
        text: page.text,
        narrationText: page.narrationText,
        imageUrl: undefined,
        audioUrl: undefined,
        sceneDescription: page.sceneDescription,
        dialogue: page.dialogue,
        characters: page.characters,
        camera: page.camera,
        cropHint: page.cropHint,
        sceneId: page.sceneId,
        background: page.background,
        speechBubbles: page.speechBubbles,
        storyStateSnapshot: pageStateSnapshotMap.get(page.pageNumber),
        characterDirections: page.characterDirections,
        storyStateUpdate: page.storyStateUpdate,
      });
    }

    return { pages, totalCostUsd };
  }

  private async generateSceneImages(
    story: Story,
    hero: Hero,
    heroName: string,
    heroAge: number,
    generated: StoryGenerationOutput,
    supportingCharacters: string[],
    characterAvatarUrls: string[],
    characterAvatarDescriptions: string[],
    isSandbox: boolean,
    storyVisualState: StoryVisualState | null,
    heroCanonSummary?: string,
    heroNeverChangeRules?: string[],
    heroFaceMetrics?: string,
    characterCanonSummaries?: string[],
    characterNeverChangeRules?: (string[] | null)[],
    characterBibles?: string[],
    supportingCharAges?: (number | null)[],
    onPageDone?: (pageNum: number, total: number) => Promise<void>,
  ): Promise<{ pages: StoryPage[]; scenes: StoryScene[]; totalCostUsd: number; castSheets?: Record<string, string>; castSheetKeys?: Record<string, string> }> {
    const scenes = generated.scenes ?? [];
    const { imageBackend, imageProvider, imageModel, costPerImage } = await this.resolveImageModelCost();
    const faceQAEnabled = await this.getBooleanSetting('FACE_CONSISTENCY_QA_ENABLED', true);
    const faceQAThreshold = await this.getNumberSetting('FACE_CONSISTENCY_THRESHOLD', 7);
    const imageQuality = await this.getStringSetting('OPENAI_IMAGE_QUALITY', 'medium');
    const allowReferenceless = await this.getBooleanSetting('OPENAI_IMAGE_ALLOW_REFERENCELESS_FALLBACK', false);
    const ageQAEnabled = await this.getBooleanSetting('APPARENT_AGE_QA_ENABLED', true);
    const ageQATolerance = await this.getNumberSetting('APPARENT_AGE_TOLERANCE', 3);
    const ageQARetryCap = await this.getNumberSetting('APPARENT_AGE_RETRY_CAP', 2);
    const childCostumeRewriteEnabled = await this.getBooleanSetting('CHILD_COSTUME_REWRITE_ENABLED', true);
    const childCostumeThreshold = await this.getNumberSetting('CHILD_COSTUME_REWRITE_AGE_THRESHOLD', 13);
    const costumedCanonicalEnabled = await this.getBooleanSetting('ENABLE_COSTUMED_CANONICAL', false);
    let totalCostUsd = 0;
    let settled = 0;

    const mode = await this.getStringSetting('IMAGE_GENERATION_MODE', 'full_generation');

    if (mode === 'avatar_only') {
      const avatarUrl = hero.avatarUrl ?? null;
      return {
        scenes: scenes.map((scene) => ({
          sceneId: scene.sceneId,
          title: scene.title,
          illustrationUrl: avatarUrl,
          illustrationBrief: scene.illustrationBrief,
          pageNumbers: scene.pages.map((p) => p.pageNumber),
        })),
        pages: generated.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
          narrationText: page.narrationText,
          imageUrl: avatarUrl ?? undefined,
          audioUrl: undefined,
          sceneDescription: page.sceneDescription,
          dialogue: page.dialogue,
          characters: page.characters,
          camera: page.camera,
          cropHint: page.cropHint,
          sceneId: page.sceneId,
          background: page.background,
          speechBubbles: page.speechBubbles ?? [],
          characterDirections: page.characterDirections ?? [],
          storyStateUpdate: page.storyStateUpdate,
        })),
        totalCostUsd: 0,
      };
    }

    const isBackgroundOnly = mode === 'background_only';
    const maxScenes = mode === 'story_only' ? 0 : mode === 'story_plus_cover' ? 1 : scenes.length;
    const { pageStateBlockMap, pageStateSnapshotMap } = this.precomputePageStateMaps(generated.pages, storyVisualState);
    const sceneStateBlockMap = new Map<string, string>();
    for (const scene of scenes) {
      const firstPageNumber = scene.pages[0]?.pageNumber;
      if (firstPageNumber !== undefined) {
        sceneStateBlockMap.set(scene.sceneId, pageStateBlockMap.get(firstPageNumber) ?? '');
      }
    }

    type SceneResult = {
      scene: SceneOutput;
      imageOutput: import('../ai/interfaces/image-generation.provider').ImageGenerationOutput | null;
      error?: string;
    };

    const illustratedScenes = scenes.slice(0, maxScenes);
    const remainingScenes = scenes.slice(maxScenes);

    // Change 4: rewrite adult-coded costume language for child characters
    const effectiveVisualState: typeof storyVisualState = (storyVisualState && childCostumeRewriteEnabled)
      ? {
          ...storyVisualState,
          costume: (storyVisualState.costume && heroAge < childCostumeThreshold)
            ? this.rewriteChildCostume(storyVisualState.costume, heroAge)
            : storyVisualState.costume,
        }
      : storyVisualState;

    // Change 5: child-character list for apparent-age QA
    const ageQAChildChars = [
      ...(heroAge < 18 ? [{ name: heroName, canonAge: heroAge, description: hero.avatarDescription ?? undefined }] : []),
      ...(supportingCharAges ?? []).flatMap((age, i) => {
        if (!age || age >= 18) return [];
        const name = supportingCharacters[i]?.split('(')[0].trim() ?? `Character ${i + 1}`;
        return [{ name, canonAge: age, description: characterAvatarDescriptions[i] ?? undefined }];
      }),
    ];

    // Change 7: costumed canonical pre-step (behind ENABLE_COSTUMED_CANONICAL flag)
    let effectiveHeroAvatarUrl = hero.avatarUrl;
    let effectiveCharAvatarUrls = [...characterAvatarUrls];
    if (costumedCanonicalEnabled && !isBackgroundOnly) {
      if (hero.avatarUrl && heroAge < 18 && effectiveVisualState?.costume) {
        try {
          const canonical = await this.imageProvider.generateCostumedCanonical({
            characterName: heroName,
            age: heroAge,
            costumeDescription: effectiveVisualState.costume,
            avatarUrl: hero.avatarUrl,
            canonSummary: heroCanonSummary,
            quality: imageQuality,
          });
          if (canonical.imageUrl) {
            effectiveHeroAvatarUrl = canonical.imageUrl;
            this.logger.log(`Costumed canonical generated for hero ${heroName}`);
          }
        } catch (err) {
          this.logger.warn(`Costumed canonical failed for hero: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      for (let i = 0; i < characterAvatarUrls.length; i++) {
        const charAge = supportingCharAges?.[i];
        if (!charAge || charAge >= 18 || !characterAvatarUrls[i]) continue;
        const charName = supportingCharacters[i]?.split('(')[0].trim();
        const charCostume = effectiveVisualState?.characterOutfits?.[charName ?? ''];
        if (!charCostume || !charName) continue;
        try {
          const canonical = await this.imageProvider.generateCostumedCanonical({
            characterName: charName,
            age: charAge,
            costumeDescription: charCostume,
            avatarUrl: characterAvatarUrls[i],
            canonSummary: characterCanonSummaries?.[i],
            quality: imageQuality,
          });
          if (canonical.imageUrl) {
            effectiveCharAvatarUrls[i] = canonical.imageUrl;
            this.logger.log(`Costumed canonical generated for ${charName}`);
          }
        } catch (err) {
          this.logger.warn(`Costumed canonical failed for ${charName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Supporting char info for Change 3 (age prefix in scene descriptions)
    const supportingCharInfoForAgePrefix = supportingCharacters.map((label, i) => ({
      name: label.split('(')[0].trim(),
      age: supportingCharAges?.[i] ?? null,
    }));

    // Character sheets: one 3D reference per character in their outfit for this story.
    let castSheets: Record<string, string> = {};
    let castSheetKeys: Record<string, string> = {};
    if (!isBackgroundOnly && imageBackend === 'gemini' && await this.getBooleanSetting('CHARACTER_SHEETS_ENABLED', true)) {
      const built = await this.buildCastSheets({
        story, hero, heroName, heroAge,
        visualState: effectiveVisualState ?? null,
        supportingNames: supportingCharInfoForAgePrefix.map((c) => c.name),
        supportingAges: supportingCharInfoForAgePrefix.map((c) => c.age),
        supportingAvatarUrls: characterAvatarUrls,
        scenes: illustratedScenes,
        imageProvider, imageModel, costPerImage, isSandbox,
      });
      castSheets = built.sheets;
      castSheetKeys = built.keys;
      totalCostUsd += built.costUsd;
      if (Object.keys(castSheets).length) {
        await this.storiesRepo.update(story.id, { storyVisualState: { ...(storyVisualState ?? ({} as StoryVisualState)), castSheets, castSheetKeys } });
      }
    }

    const buildSceneImageInput = (scene: SceneOutput, styleReferenceUrl?: string): ImageGenerationInput => {
      const firstPage = scene.pages[0];
      const sceneRefs = this.sheetRefsFor(
        castSheets, heroName,
        scene.pages.flatMap((p) => p.characterDirections ?? []),
        [scene.illustrationBrief, ...scene.pages.map((p) => p.sceneDescription ?? '')].join(' '),
      );
      return {
        castReferences: sceneRefs.length ? sceneRefs : undefined,
        // Change 3: embed hero+character ages in the first mention of each name
        sceneDescription: this.prefixAgesInSceneDescription(
          scene.illustrationBrief, heroName, heroAge, supportingCharInfoForAgePrefix,
        ),
        heroName,
        heroAge,
        supportingCharacters,
        heroAvatarUrl: effectiveHeroAvatarUrl ?? undefined,
        heroAvatarDescription: hero.avatarDescription ?? undefined,
        characterAvatarUrls: effectiveCharAvatarUrls,
        characterAvatarDescriptions,
        style: STORYBOOK_STYLE,
        styleReferenceUrl,
        storyVisualState: effectiveVisualState ?? undefined,
        characters: firstPage?.characters,
        camera: 'wide cinematic composition, characters positioned with generous background space on all sides for flexible cropping',
        heroCanonSummary,
        heroNeverChangeRules,
        heroFaceMetrics,
        characterCanonSummaries,
        characterNeverChangeRules,
        characterBibles,
        supportingCharacterAges: supportingCharAges ?? undefined,
        storyStateBlock: sceneStateBlockMap.get(scene.sceneId) ?? undefined,
        characterDirections: firstPage?.characterDirections,
        backgroundOnlyMode: isBackgroundOnly,
        quality: imageQuality,
        allowReferenceless,
      };
    };

    const generateSceneImage = async (scene: SceneOutput, styleReferenceUrl?: string): Promise<SceneResult> => {
      try {
        const imageInput = buildSceneImageInput(scene, styleReferenceUrl);
        let imageOutput = await this.generateImageWithRetry(imageInput);

        if (!isBackgroundOnly && faceQAEnabled && hero.avatarUrl && imageOutput.imageBase64) {
          const qaResult = await this.imageProvider.checkFaceConsistency(
            hero.avatarUrl, imageOutput.imageBase64, heroName,
          ).catch(() => null);
          if (qaResult && qaResult.identityScore < faceQAThreshold) {
            this.logger.warn(
              `Face QA scene ${scene.sceneId}: score=${qaResult.identityScore}/${faceQAThreshold} — regenerating with identity boost`,
            );
            try {
              imageOutput = await this.generateImageWithRetry({ ...imageInput, identityBoostMode: true });
            } catch {
              this.logger.warn(`Identity boost regeneration failed for scene ${scene.sceneId}, using original`);
            }
          }
        }

        // Change 5: apparent-age QA gate
        if (!isBackgroundOnly && ageQAEnabled && ageQAChildChars.length > 0 && imageOutput.imageBase64) {
          const ageResult = await this.imageProvider.checkApparentAge({
            imageBase64: imageOutput.imageBase64,
            characters: ageQAChildChars,
          }).catch(() => null);
          if (ageResult) {
            const hasDrift = ageResult.estimates.some(
              (e) => Math.abs(e.estimatedAge - e.canonAge) > ageQATolerance,
            );
            if (hasDrift) {
              this.logger.warn(
                `Age QA scene ${scene.sceneId}: drift — ${ageResult.estimates
                  .map((e) => `${e.name} canon=${e.canonAge} est=${e.estimatedAge}`).join(', ')}`,
              );
              for (let attempt = 0; attempt < ageQARetryCap; attempt++) {
                try {
                  const retryOutput = await this.generateImageWithRetry({ ...imageInput, identityBoostMode: true });
                  const retryCheck = retryOutput.imageBase64
                    ? await this.imageProvider.checkApparentAge({
                        imageBase64: retryOutput.imageBase64, characters: ageQAChildChars,
                      }).catch(() => null)
                    : null;
                  const stillDrift = retryCheck?.estimates.some(
                    (e) => Math.abs(e.estimatedAge - e.canonAge) > ageQATolerance,
                  ) ?? true;
                  if (!stillDrift) { imageOutput = retryOutput; break; }
                } catch { break; }
              }
            }
          }
        }

        settled++;
        if (onPageDone) await onPageDone(settled, illustratedScenes.length).catch(() => {});
        return { scene, imageOutput };
      } catch (err) {
        settled++;
        if (onPageDone) await onPageDone(settled, illustratedScenes.length).catch(() => {});
        return { scene, imageOutput: null, error: err instanceof Error ? err.message : 'Unknown' };
      }
    };

    // Generate scene 1 first so its output can anchor visual consistency for all later scenes
    const sceneResults: SceneResult[] = [];
    let styleReferenceUrl: string | undefined;
    const preUploadedUrls = new Map<string, string>();
    if (illustratedScenes.length > 0) {
      const scene1Result = await generateSceneImage(illustratedScenes[0]);
      sceneResults.push(scene1Result);
      // The Gemini backend returns base64 with imageUrl '' — previously that empty string became the
      // "anchor", so later scenes silently had no consistency reference at all.
      const scene1Output = scene1Result.imageOutput;
      if (scene1Output?.imageBase64) {
        try {
          const url = await this.uploadService.uploadGeneratedImage(
            story.userId, story.id, illustratedScenes[0].pages[0]?.pageNumber ?? 1, scene1Output.imageBase64,
          );
          preUploadedUrls.set(illustratedScenes[0].sceneId, url);
          styleReferenceUrl = url;
        } catch (err) {
          this.logger.warn(`Scene 1 anchor upload failed for ${story.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        styleReferenceUrl = scene1Output?.imageUrl || undefined;
      }
    }

    // Remaining scenes run in parallel, each receiving scene 1's image as a visual anchor
    const remainingIllustrated = illustratedScenes.slice(1);
    const remainingResults = await this.mapWithConcurrency(
      remainingIllustrated,
      3,
      (scene) => generateSceneImage(scene, styleReferenceUrl),
    );
    sceneResults.push(...remainingResults);

    const sceneIllustrationMap = new Map<string, string | undefined>();
    const sceneImageBase64Map = new Map<string, string | undefined>();
    const storedScenes: StoryScene[] = [];

    for (const { scene, imageOutput, error } of sceneResults) {
      if (!imageOutput) {
        this.logger.warn(`Scene image gen failed for story ${story.id}, scene ${scene.sceneId}: ${error ?? 'Unknown'}`);
        sceneIllustrationMap.set(scene.sceneId, undefined);
        sceneImageBase64Map.set(scene.sceneId, undefined);
        storedScenes.push({
          sceneId: scene.sceneId,
          title: scene.title,
          illustrationUrl: null,
          illustrationBrief: scene.illustrationBrief,
          pageNumbers: scene.pages.map((p) => p.pageNumber),
        });
        continue;
      }

      let illustrationUrl: string | undefined;
      try {
        const fileKey = scene.pages[0]?.pageNumber ?? 1;
        illustrationUrl = preUploadedUrls.get(scene.sceneId) ?? (imageOutput.imageBase64
          ? await this.uploadService.uploadGeneratedImage(story.userId, story.id, fileKey, imageOutput.imageBase64)
          : imageOutput.imageUrl || undefined);

        totalCostUsd += costPerImage;
        await this.aiUsageLogsRepo.save(
          this.aiUsageLogsRepo.create({
            userId: story.userId,
            storyId: story.id,
            universeId: story.universeId ?? null,
            provider: imageProvider,
            model: imageModel,
            operation: AiOperation.ImageGeneration,
            imagesGenerated: 1,
            estimatedCostUsd: costPerImage,
            isSandbox,
          }),
        );
      } catch (uploadErr) {
        this.logger.warn(
          `Scene image upload failed for ${story.id}, scene ${scene.sceneId}: ${
            uploadErr instanceof Error ? uploadErr.message : 'Unknown'
          }`,
        );
      }

      sceneIllustrationMap.set(scene.sceneId, illustrationUrl);
      sceneImageBase64Map.set(scene.sceneId, imageOutput.imageBase64);
      storedScenes.push({
        sceneId: scene.sceneId,
        title: scene.title,
        illustrationUrl: illustrationUrl ?? null,
        illustrationBrief: scene.illustrationBrief,
        pageNumbers: scene.pages.map((p) => p.pageNumber),
      });
    }

    for (const scene of remainingScenes) {
      sceneIllustrationMap.set(scene.sceneId, undefined);
      sceneImageBase64Map.set(scene.sceneId, undefined);
      storedScenes.push({
        sceneId: scene.sceneId,
        title: scene.title,
        illustrationUrl: null,
        illustrationBrief: scene.illustrationBrief,
        pageNumbers: scene.pages.map((p) => p.pageNumber),
      });
    }

    const speechBubbleLayoutEnabled = await this.getBooleanSetting('ENABLE_SPEECH_BUBBLE_LAYOUT_QA', false);
    const bubbleDetectionEnabled = await this.getBooleanSetting('SPEECH_BUBBLE_DETECTION_ENABLED', true);
    const storyCast = this.buildDetectionCast({
      heroName,
      heroAge,
      heroGender: hero.gender ?? null,
      visualState: effectiveVisualState ?? null,
      supporting: supportingCharInfoForAgePrefix,
    });

    // Decide the (capped) redraws in story order first, then process pages in parallel — each page's redraw and
    // bubble detection is independent of the others.
    let expressionRedrawsLeft = await this.getNumberSetting('MAX_EXPRESSION_VARIANTS', Number(SETTING_DEFAULTS.MAX_EXPRESSION_VARIANTS.value));
    const pageJobs = scenes.flatMap((scene) => scene.pages.map((page) => {
      // Gemini marks 'reuse' when character poses/expressions are essentially unchanged
      // from the scene base image — only speech bubbles differ, so no new image is needed.
      const wantsPageSpecificExpression =
        page.imageVariant !== 'reuse' &&
        page.pageNumber !== scene.pages[0]?.pageNumber &&
        ((page.speechBubbles?.length ?? 0) > 0 ||
          page.characterDirections?.some((c) => c.isSpeaking || c.mouthState === 'speaking'));
      // Each redraw is a full image — cap them per story (sheets keep the reused scene image consistent).
      const needsPageSpecificExpression = !!wantsPageSpecificExpression && expressionRedrawsLeft > 0;
      if (needsPageSpecificExpression) expressionRedrawsLeft--;
      return { scene, page, needsPageSpecificExpression };
    }));

    const pages: StoryPage[] = await this.mapWithConcurrency(pageJobs, 4, async ({ scene, page, needsPageSpecificExpression }) => {
        const sceneImageUrl = sceneIllustrationMap.get(scene.sceneId);
        let pageImageUrl = sceneImageUrl;
        let pageImageBase64: string | undefined = sceneImageBase64Map.get(scene.sceneId);

        if (!isBackgroundOnly && sceneImageUrl && needsPageSpecificExpression) {
          try {
            const imageInput: ImageGenerationInput = {
              sceneDescription: this.prefixAgesInSceneDescription(
                page.sceneDescription || scene.illustrationBrief, heroName, heroAge, supportingCharInfoForAgePrefix,
              ),
              heroName,
              heroAge,
              supportingCharacters,
              heroAvatarUrl: effectiveHeroAvatarUrl ?? undefined,
              heroAvatarDescription: hero.avatarDescription ?? undefined,
              characterAvatarUrls: effectiveCharAvatarUrls,
              characterAvatarDescriptions,
              style: STORYBOOK_STYLE,
              // Anchor to this scene's own illustration so hair/costume/face stay identical to the base scene image
              styleReferenceUrl: sceneImageUrl,
              castReferences: (() => {
                const refs = this.sheetRefsFor(castSheets, heroName, page.characterDirections ?? [], page.sceneDescription ?? '');
                return refs.length ? refs : undefined;
              })(),
              storyVisualState: effectiveVisualState ?? undefined,
              dialogue: page.dialogue,
              characters: page.characters,
              camera: page.camera ?? 'medium shot with face clearly visible',
              heroCanonSummary,
              heroNeverChangeRules,
              heroFaceMetrics,
              characterCanonSummaries,
              characterNeverChangeRules,
              characterBibles,
              supportingCharacterAges: supportingCharAges ?? undefined,
              storyStateBlock: pageStateBlockMap.get(page.pageNumber) ?? undefined,
              characterDirections: page.characterDirections,
            };
            let output = await this.generateImageWithRetry(imageInput, 1);
            if (faceQAEnabled && hero.avatarUrl && output.imageBase64) {
              const qaResult = await this.imageProvider.checkFaceConsistency(
                hero.avatarUrl, output.imageBase64, heroName,
              ).catch(() => null);
              if (qaResult && qaResult.identityScore < faceQAThreshold) {
                output = await this.generateImageWithRetry({ ...imageInput, identityBoostMode: true }, 1);
              }
            }
            pageImageUrl = output.imageBase64
              ? await this.uploadService.uploadGeneratedImage(story.userId, story.id, page.pageNumber, output.imageBase64)
              : output.imageUrl || pageImageUrl;
            pageImageBase64 = output.imageBase64;
            totalCostUsd += costPerImage;
            await this.aiUsageLogsRepo.save(
              this.aiUsageLogsRepo.create({
                userId: story.userId,
                storyId: story.id,
                universeId: story.universeId ?? null,
                provider: imageProvider,
                model: imageModel,
                operation: AiOperation.ImageGeneration,
                imagesGenerated: 1,
                estimatedCostUsd: costPerImage,
                isSandbox,
              }),
            );
          } catch (err) {
            this.logger.warn(
              `Page-specific expression image failed for story ${story.id}, page ${page.pageNumber}; reusing scene image: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }

        let speechBubbles: StoryPage['speechBubbles'] = page.speechBubbles;
        let characterLayout: StoryPage['characterLayout'];
        if (bubbleDetectionEnabled && !isBackgroundOnly && (pageImageBase64 || pageImageUrl) && page.speechBubbles?.length) {
          const placed = await this.placeBubblesFromImage({
            pageNumber: page.pageNumber,
            imageBase64: pageImageBase64,
            imageUrl: pageImageUrl,
            speechBubbles: page.speechBubbles as NonNullable<StoryPage['speechBubbles']>,
            cast: this.withPageCast(storyCast, page.characterDirections),
          });
          speechBubbles = placed.speechBubbles;
          characterLayout = placed.characterLayout;
        } else if (speechBubbleLayoutEnabled) {
          speechBubbles = await this.enrichSpeechBubbleLayout({
            pageNumber: page.pageNumber,
            imageUrl: isBackgroundOnly ? undefined : pageImageUrl,
            imageBase64: isBackgroundOnly ? undefined : pageImageBase64,
            sceneDescription: page.sceneDescription,
            characterDirections: page.characterDirections,
            speechBubbles: page.speechBubbles,
          });
        }

        return {
          pageNumber: page.pageNumber,
          text: page.text,
          narrationText: page.narrationText,
          imageUrl: isBackgroundOnly ? undefined : pageImageUrl,
          backgroundUrl: isBackgroundOnly ? pageImageUrl : undefined,
          audioUrl: undefined,
          sceneDescription: page.sceneDescription,
          dialogue: page.dialogue,
          characters: page.characters,
          camera: page.camera,
          cropHint: page.cropHint,
          sceneId: scene.sceneId,
          background: page.background,
          speechBubbles,
          characterLayout,
          storyStateSnapshot: pageStateSnapshotMap.get(page.pageNumber),
          characterDirections: page.characterDirections,
          storyStateUpdate: page.storyStateUpdate,
        } as StoryPage;
    });

    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    return {
      pages, scenes: storedScenes, totalCostUsd,
      castSheets: Object.keys(castSheets).length ? castSheets : undefined,
      castSheetKeys: Object.keys(castSheetKeys).length ? castSheetKeys : undefined,
    };
  }

  private async generateImageWithRetry(input: ImageGenerationInput, attempts = 2) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.imageProvider.generateImage(input);
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `Image generation attempt ${attempt}/${attempts} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        if (attempt < attempts) await this.sleep(1200 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Image generation failed');
  }

  // ── Image model + cost ─────────────────────────────────────────────────────

  /** List price per 1K image (USD) — the GEMINI_IMAGE_COST_PER_IMAGE setting is only a fallback for unknown models. */
  private static readonly GEMINI_IMAGE_PRICES: Record<string, number> = {
    'gemini-nano-banana-2.1': 0.0336,
    'gemini-3.1-flash-lite-image': 0.0336,
    'gemini-3.1-flash-image': 0.067,
    'gemini-3-pro-image': 0.134,
  };

  private async resolveImageModelCost() {
    const imageBackend = await this.getStringSetting('IMAGE_GENERATION_BACKEND', 'openai');
    const imageProvider = imageBackend === 'gemini' ? 'gemini' : 'openai';
    const imageModel = imageBackend === 'gemini'
      ? await this.getStringSetting('IMAGE_GENERATION_MODEL', SETTING_DEFAULTS.IMAGE_GENERATION_MODEL.value)
      : (this.config.get<string>('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1');
    const knownPrice = imageBackend === 'gemini' ? GenerationService.GEMINI_IMAGE_PRICES[imageModel] : undefined;
    const imageCostKey = imageBackend === 'gemini' ? 'GEMINI_IMAGE_COST_PER_IMAGE' : 'OPENAI_IMAGE_COST_PER_IMAGE';
    const costPerImage = knownPrice ?? await this.getNumberSetting(
      imageCostKey as keyof typeof SETTING_DEFAULTS,
      Number(SETTING_DEFAULTS[imageCostKey as keyof typeof SETTING_DEFAULTS]?.value ?? SETTING_DEFAULTS['OPENAI_IMAGE_COST_PER_IMAGE'].value),
    );
    return { imageBackend, imageProvider, imageModel, costPerImage };
  }

  // ── Character sheets ───────────────────────────────────────────────────────

  /** Renames every reference to the hero's title (e.g. "Commander", "Commander Siddhant") to the hero's name. */
  private normalizeHeroAliases(generated: StoryGenerationOutput, heroName: string, heroTitle: string | null): void {
    const heroWords = new Set(heroName.toLowerCase().split(/\s+/));
    const aliases = new Set<string>();
    if (heroTitle?.trim()) {
      aliases.add(heroTitle.trim().toLowerCase());
      for (const word of heroTitle.toLowerCase().split(/\s+/)) if (word.length > 2 && !heroWords.has(word)) aliases.add(word);
      aliases.add(`${heroTitle} ${heroName}`.toLowerCase());
    }
    if (!aliases.size) return;
    const fix = (name?: string) => (name && aliases.has(name.trim().toLowerCase()) ? heroName : name);
    const pages = [...(generated.pages ?? []), ...(generated.scenes ?? []).flatMap((sc) => sc.pages)];
    for (const page of pages as Array<Record<string, any>>) {
      for (const b of page.speechBubbles ?? []) b.speakerName = fix(b.speakerName);
      for (const d of page.dialogue ?? []) d.speaker = fix(d.speaker);
      for (const d of page.characterDirections ?? []) d.name = fix(d.name);
      for (const c of page.characters ?? []) c.name = fix(c.name);
    }
    for (const map of [generated.storyVisualState?.characterOutfits, generated.storyVisualState?.characterLooks]) {
      if (!map) continue;
      for (const key of Object.keys(map)) if (aliases.has(key.toLowerCase())) delete map[key];
    }
  }

  /** Vision descriptions sometimes come back as refusals ("I'm unable to describe…") — never use those. */
  private usableDescription(text?: string | null): string | null {
    if (!text?.trim()) return null;
    return /\b(unable to|can'?t|cannot|not able to|sorry|i'?m not)\b/i.test(text.slice(0, 120)) ? null : text.trim();
  }

  /**
   * One 3D reference per character in their outfit for THIS story, drawn before any page. Pages then copy
   * these sheets, so faces, outfits and art style stay identical — including villains and companions,
   * who have no photo at all. Returns name → uploaded image URL.
   */
  private async buildCastSheets(params: {
    story: Story;
    hero: Hero;
    heroName: string;
    heroAge: number;
    visualState: StoryVisualState | null;
    supportingNames: string[];
    supportingAges: (number | null)[];
    supportingAvatarUrls: string[];
    scenes: SceneOutput[];
    imageProvider: string;
    imageModel: string;
    costPerImage: number;
    isSandbox: boolean;
  }): Promise<{ sheets: Record<string, string>; keys: Record<string, string>; costUsd: number }> {
    const generateSheet = this.imageProvider.generateCharacterSheet?.bind(this.imageProvider);
    if (!generateSheet) return { sheets: {}, keys: {}, costUsd: 0 };

    const relationships = new Map<string, string>();
    const ids = (params.story.characterIds ?? []) as string[];
    if (ids.length) {
      const chars = await this.charactersRepo.find({ where: ids.map((id) => ({ id })) });
      for (const c of chars) if (c.relationship) relationships.set(c.name.toLowerCase(), c.relationship);
    }
    const outfits = params.visualState?.characterOutfits ?? {};
    const looks = params.visualState?.characterLooks ?? {};
    const gender = (g?: string | null) => (g === 'girl' ? 'girl' : g === 'boy' ? 'boy' : 'child');

    type Member = { name: string; descriptor: string; outfit?: string | null; appearance?: string | null; referenceUrl?: string | null };
    const members: Member[] = [{
      name: params.heroName,
      descriptor: `${params.heroAge}-year-old ${gender(params.hero.gender)}, the hero of the story`,
      // The hero's gear (sword, amulet…) is drawn into the sheet so every page shows the same item.
      outfit: [params.visualState?.costume, params.visualState?.weapon ? `carrying ${params.visualState.weapon}` : null].filter(Boolean).join(', ') || null,
      referenceUrl: params.hero.avatarUrl,
      appearance: params.hero.avatarUrl ? null : this.usableDescription(params.hero.avatarDescription),
    }];
    params.supportingNames.forEach((name, i) => {
      const age = params.supportingAges[i];
      const relation = relationships.get(name.toLowerCase());
      members.push({
        name,
        descriptor: [age ? `${age} years old` : null, relation ? `${params.heroName}'s ${relation.toLowerCase()}` : null]
          .filter(Boolean).join(', ') || "a member of the hero's family",
        outfit: outfits[name] ?? null,
        referenceUrl: params.supportingAvatarUrls[i] || null,
      });
    });
    // Characters with no photo who actually appear in the pictures (villains, creatures, companions).
    const known = new Set(members.map((m) => m.name.toLowerCase()));
    const appearing = new Map<string, number>();
    for (const scene of params.scenes) {
      for (const page of scene.pages) {
        for (const d of page.characterDirections ?? []) {
          if (!d.name || d.visible === false || known.has(d.name.toLowerCase())) continue;
          appearing.set(d.name, (appearing.get(d.name) ?? 0) + 1);
        }
      }
      // Villains/creatures the writer described but didn't list in characterDirections — count text mentions.
      const sceneText = [scene.illustrationBrief, ...scene.pages.map((p) => p.sceneDescription ?? '')].join(' ').toLowerCase();
      for (const name of Object.keys(looks)) {
        if (known.has(name.toLowerCase())) continue;
        if (sceneText.includes(name.toLowerCase().split(/\s+/)[0])) appearing.set(name, (appearing.get(name) ?? 0) + 1);
      }
    }
    [...appearing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([name]) => {
      members.push({
        name,
        descriptor: 'a character in this story',
        appearance: looks[name] ?? (params.visualState?.companion?.startsWith(name) ? params.visualState.companion : null),
        outfit: outfits[name] ?? null,
      });
    });

    // Reuse a sheet from an earlier story of this hero when the character and outfit text are identical.
    const sheetKey = (name: string, outfit?: string | null, appearance?: string | null) =>
      [name, outfit ?? '', appearance ?? ''].map((x) => x.trim().toLowerCase()).join('|');
    const reusable = new Map<string, string>();
    const earlier = await this.storiesRepo.find({
      where: { heroId: params.story.heroId, status: StoryStatus.Completed },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    for (const prev of earlier) {
      const vs = prev.storyVisualState;
      for (const [name, url] of Object.entries(vs?.castSheets ?? {})) {
        const key = vs?.castSheetKeys?.[name];
        if (key && !reusable.has(key)) reusable.set(key, url);
      }
    }

    const results = await this.mapWithConcurrency(members, 3, async (m) => {
      const existing = reusable.get(sheetKey(m.name, m.outfit, m.appearance));
      if (existing) return { name: m.name, url: existing, reused: true };
      try {
        const out = await generateSheet({ name: m.name, descriptor: m.descriptor, outfit: m.outfit, appearance: m.appearance, referenceUrl: m.referenceUrl });
        if (!out.imageBase64) return null;
        const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'character';
        const url = await this.uploadService.uploadGeneratedImage(params.story.userId, params.story.id, `sheet-${slug}`, out.imageBase64);
        await this.aiUsageLogsRepo.save(this.aiUsageLogsRepo.create({
          userId: params.story.userId,
          storyId: params.story.id,
          universeId: params.story.universeId ?? null,
          provider: params.imageProvider,
          model: params.imageModel,
          operation: AiOperation.CharacterSheetGeneration,
          imagesGenerated: 1,
          estimatedCostUsd: params.costPerImage,
          isSandbox: params.isSandbox,
        }));
        return { name: m.name, url, reused: false };
      } catch (err) {
        this.logger.warn(`Character sheet failed for ${m.name}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    });

    const sheets: Record<string, string> = {};
    const keys: Record<string, string> = {};
    let costUsd = 0;
    results.forEach((r, i) => {
      if (!r) return;
      sheets[r.name] = r.url;
      keys[r.name] = sheetKey(members[i].name, members[i].outfit, members[i].appearance);
      if (!r.reused) costUsd += params.costPerImage;
    });
    const reusedNames = results.filter((r) => r?.reused).map((r) => r!.name);
    this.logger.log(
      `Character sheets for story ${params.story.id}: ${Object.keys(sheets).join(', ') || 'none'}` +
      (reusedNames.length ? ` (reused: ${reusedNames.join(', ')})` : ''),
    );
    return { sheets, keys, costUsd };
  }

  /** The sheets for the characters in a picture — hero first, at most 4 (the model's character limit). */
  private sheetRefsFor(
    sheets: Record<string, string>,
    heroName: string,
    directions: Array<{ name?: string; visible?: boolean }>,
    sceneText = '',
  ): Array<{ name: string; url: string }> {
    const first = (n: string) => n.toLowerCase().split(/\s+/)[0];
    const find = (name: string) => {
      const key = Object.keys(sheets).find((k) => k.toLowerCase() === name.toLowerCase())
        ?? Object.keys(sheets).find((k) => first(k) === first(name));
      return key ? { name: key, url: sheets[key] } : null;
    };
    const text = sceneText.toLowerCase();
    const mentioned = Object.keys(sheets).filter((k) => text.includes(first(k)));
    const names = [heroName, ...directions.filter((d) => d.name && d.visible !== false).map((d) => d.name as string), ...mentioned];
    const refs: Array<{ name: string; url: string }> = [];
    for (const n of names) {
      const ref = find(n);
      if (ref && !refs.some((r) => r.name === ref.name)) refs.push(ref);
    }
    return refs.slice(0, 4);
  }

  // ── Speech bubble placement from the finished image ───────────────────────

  /** Who might be in a picture, described well enough for a vision model to tell them apart. */
  private buildDetectionCast(params: {
    heroName: string;
    heroAge: number;
    heroGender: string | null;
    visualState: StoryVisualState | null;
    supporting: Array<{ name: string; age: number | null }>;
  }): CastMember[] {
    const outfits = params.visualState?.characterOutfits ?? {};
    const cast: CastMember[] = [{
      name: params.heroName,
      description: [
        `${params.heroAge}-year-old ${params.heroGender ?? 'child'}, the hero`,
        params.visualState?.costume ? `wearing ${params.visualState.costume}` : null,
      ].filter(Boolean).join(', '),
    }];
    for (const c of params.supporting) {
      cast.push({
        name: c.name,
        description: [c.age ? `about ${c.age} years old` : null, outfits[c.name] ? `wearing ${outfits[c.name]}` : null]
          .filter(Boolean).join(', ') || 'supporting character',
      });
    }
    if (params.visualState?.companion) {
      const [name, type] = params.visualState.companion.split('(').map((s) => s.replace(')', '').trim());
      cast.push({ name, description: type ? `the hero's companion, a ${type}` : "the hero's companion" });
    }
    return cast;
  }

  /** Adds characters named only on this page (e.g. the villain) so their bubbles can be placed too. */
  private withPageCast(cast: CastMember[], directions?: StoryPage['characterDirections']): CastMember[] {
    const known = new Set(cast.map((c) => c.name.toLowerCase()));
    const extra = (directions ?? [])
      .filter((d) => d.name && !known.has(d.name.toLowerCase()))
      .map((d) => ({ name: d.name, description: [d.role, d.expression].filter(Boolean).join(', ') || 'story character' }));
    return [...cast, ...extra];
  }

  private async getImageAspect(): Promise<number> {
    const ratio = await this.getStringSetting('STORY_IMAGE_ASPECT_RATIO', SETTING_DEFAULTS.STORY_IMAGE_ASPECT_RATIO.value);
    const [w, h] = ratio.split(':').map(Number);
    return w > 0 && h > 0 ? w / h : 1;
  }

  /**
   * Finds every character's head and mouth in the finished page image, then places each bubble next to its
   * real speaker (never over a face). Falls back to the unplaced bubbles if detection fails.
   */
  private async placeBubblesFromImage(params: {
    pageNumber: number;
    imageBase64?: string;
    imageUrl?: string;
    speechBubbles: NonNullable<StoryPage['speechBubbles']>;
    cast: CastMember[];
  }): Promise<{ speechBubbles: StoryPage['speechBubbles']; characterLayout: StoryPage['characterLayout'] }> {
    try {
      const located = await this.characterLocator.locate({
        imageBase64: params.imageBase64,
        imageUrl: params.imageBase64 ? undefined : params.imageUrl,
        cast: params.cast,
      });
      const placements = layoutBubbles(params.speechBubbles, located, await this.getImageAspect());
      const speechBubbles = params.speechBubbles.map((bubble, i) => {
        const placed = placements[i];
        if (!placed) return bubble;
        return {
          ...bubble,
          anchorPoint: placed.anchorPoint,
          bubbleRect: placed.bubbleRect,
          layoutConfidence: placed.layoutConfidence,
          layoutSource: 'detected' as const,
        };
      });
      const missing = placements.filter((p) => !p).length;
      if (missing) this.logger.warn(`Bubble layout page ${params.pageNumber}: ${missing} speaker(s) not found in image`);
      return { speechBubbles, characterLayout: located };
    } catch (err) {
      this.logger.warn(`Bubble detection failed for page ${params.pageNumber}: ${err instanceof Error ? err.message : String(err)}`);
      return { speechBubbles: params.speechBubbles, characterLayout: undefined };
    }
  }

  /** Re-places speech bubbles on an existing story from its current images — no images are regenerated. */
  async relayoutStoryBubbles(storyId: string): Promise<{ pages: number; bubblesPlaced: number; bubblesUnplaced: number }> {
    const story = await this.storiesRepo.findOne({ where: { id: storyId } });
    if (!story) throw new Error('Story not found');
    const hero = await this.heroesRepo.findOne({ where: { id: story.heroId } });
    const supportingIds = (story.characterIds ?? []) as string[];
    const supporting = supportingIds.length
      ? await this.charactersRepo.find({ where: supportingIds.map((id) => ({ id })) })
      : [];
    const cast = this.buildDetectionCast({
      heroName: hero?.name ?? 'Hero',
      heroAge: hero?.dob ? this.computeAge(hero.dob) : 8,
      heroGender: hero?.gender ?? null,
      visualState: story.storyVisualState ?? null,
      supporting: supporting.map((c) => ({ name: c.name, age: c.dob ? this.computeAge(c.dob) : null })),
    });

    let bubblesPlaced = 0;
    let bubblesUnplaced = 0;
    const pages: StoryPage[] = [];
    for (const page of story.pages ?? []) {
      if (!page.imageUrl || !page.speechBubbles?.length) {
        pages.push(page);
        continue;
      }
      // Drop any earlier guessed/fake placement before re-placing from the real image.
      const clean = page.speechBubbles.map(({ anchorPoint, bubbleRect, layoutConfidence, layoutSource, ...rest }) => rest);
      const placed = await this.placeBubblesFromImage({
        pageNumber: page.pageNumber,
        imageUrl: page.imageUrl,
        speechBubbles: clean,
        cast: this.withPageCast(cast, page.characterDirections),
      });
      for (const b of placed.speechBubbles ?? []) (b.layoutSource ? bubblesPlaced++ : bubblesUnplaced++);
      pages.push({ ...page, speechBubbles: placed.speechBubbles, characterLayout: placed.characterLayout });
    }
    await this.storiesRepo.update(story.id, { pages });
    return { pages: pages.length, bubblesPlaced, bubblesUnplaced };
  }

  private async enrichSpeechBubbleLayout(params: {
    pageNumber: number;
    imageUrl?: string;
    imageBase64?: string;
    sceneDescription?: string;
    characterDirections?: StoryPage['characterDirections'];
    speechBubbles?: StoryPage['speechBubbles'];
  }): Promise<StoryPage['speechBubbles']> {
    const bubbles = params.speechBubbles ?? [];
    if (!bubbles.length || (!params.imageUrl && !params.imageBase64)) return bubbles;

    try {
      const layout = await this.imageProvider.locateSpeechBubbleAnchors({
        imageUrl: params.imageUrl,
        imageBase64: params.imageBase64,
        pageNumber: params.pageNumber,
        sceneDescription: params.sceneDescription,
        characterDirections: params.characterDirections,
        speechBubbles: bubbles.map((bubble) => ({
          speakerName: bubble.speakerName,
          text: bubble.text,
          preferredPosition: bubble.preferredPosition,
          tailDirection: bubble.tailDirection,
        })),
      });

      if (!layout?.bubbles?.length) return bubbles;

      return bubbles.map((bubble, index) => {
        const placed = layout.bubbles[index];
        if (!placed) return bubble;
        return {
          ...bubble,
          anchorPoint: placed.anchorPoint,
          bubbleRect: placed.bubbleRect,
          layoutConfidence: placed.confidence,
        };
      });
    } catch (err) {
      this.logger.warn(
        `Speech bubble layout failed for page ${params.pageNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return bubbles;
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await mapper(items[index], index);
      }
    });

    await Promise.all(workers);
    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Gemini TTS list price per second of audio (USD). */
  private static readonly GEMINI_TTS_PRICE_PER_SECOND: Record<string, number> = {
    'gemini-3.8-flash-tts': 0.000225,
    'gemini-3.8-flash-lite-tts': 0.00015,
  };

  private async generatePageAudio(story: Story, pages: StoryPage[], isSandbox: boolean): Promise<{ pages: StoryPage[]; totalCostUsd: number }> {
    const ttsProvider = await this.getStringSetting('TTS_PROVIDER', SETTING_DEFAULTS.TTS_PROVIDER.value);
    const isGeminiTTS = ttsProvider === 'gemini';
    const ttsModel = isGeminiTTS
      ? await this.getStringSetting('GEMINI_TTS_MODEL', SETTING_DEFAULTS.GEMINI_TTS_MODEL.value)
      : (this.config.get<string>('OPENAI_TTS_MODEL') ?? 'gpt-4o-mini-tts');
    const pricePerSecond = isGeminiTTS ? GenerationService.GEMINI_TTS_PRICE_PER_SECOND[ttsModel] : undefined;
    const ttsCostPerChar = isGeminiTTS
      ? await this.getNumberSetting('GEMINI_TTS_COST_PER_CHAR', 0)
      : await this.getNumberSetting('OPENAI_TTS_COST_PER_CHAR', Number(SETTING_DEFAULTS['OPENAI_TTS_COST_PER_CHAR'].value));
    const ttsVoice = isGeminiTTS
      ? await this.getStringSetting('GEMINI_TTS_VOICE', SETTING_DEFAULTS.GEMINI_TTS_VOICE.value)
      : await this.getStringSetting('TTS_VOICE', 'nova');
    const ttsSpeed = await this.getNumberSetting('TTS_SPEED_RATIO', 0.9);
    const ttsAccentStyle = await this.getStringSetting('TTS_ACCENT_STYLE', 'indian_english');
    const ttsTone = await this.getStringSetting('TTS_TONE', 'warm_bedtime_story');
    const enableIndianEnglish = await this.getBooleanSetting('ENABLE_INDIAN_ENGLISH_NARRATION', true);
    const narrationLanguage = enableIndianEnglish ? 'en-IN' : 'en-US';
    const narrationAccent = enableIndianEnglish
      ? ttsAccentStyle.replace(/_/g, ' ')
      : 'neutral English';
    const narrationTone = ttsTone.replace(/_/g, ' ');

    // Pages are independent — narrate a few at once instead of one after another.
    const narrated = await this.mapWithConcurrency(pages, 3, async (page) => {
      let audioUrl: string | undefined;
      let costUsd = 0;
      const finalNarrationText = this.buildFinalNarrationText(page);
      try {
        const narration = await this.narrationProvider.generateNarration({
          text: finalNarrationText,
          voice: ttsVoice,
          model: isGeminiTTS ? ttsModel : undefined,
          speed: ttsSpeed,
          language: narrationLanguage,
          accent: narrationAccent,
          tone: narrationTone,
          audience: 'children',
        });
        if (narration.audioBuffer) {
          // WAV narration is ~1 MB per page — send parents a small MP3 instead.
          const isWav = narration.audioBuffer.subarray(0, 4).toString('ascii') === 'RIFF';
          const audio = isWav ? await wavToMp3(narration.audioBuffer) : narration.audioBuffer;
          audioUrl = await this.uploadService.uploadPageAudio(story.userId, story.id, page.pageNumber, audio);
        }

        const seconds = narration.durationSeconds
          ?? Math.max(5, Math.ceil(finalNarrationText.split(/\s+/).filter(Boolean).length * 0.55));
        costUsd = pricePerSecond !== undefined ? seconds * pricePerSecond : finalNarrationText.length * ttsCostPerChar;
        await this.aiUsageLogsRepo.save(
          this.aiUsageLogsRepo.create({
            userId: story.userId,
            storyId: story.id,
            universeId: story.universeId ?? null,
            provider: isGeminiTTS ? 'gemini' : 'openai',
            model: ttsModel,
            operation: AiOperation.Narration,
            audioSeconds: Math.round(seconds),
            estimatedCostUsd: costUsd,
            isSandbox,
          }),
        );
      } catch (err) {
        this.logger.warn(
          `Audio gen failed for story ${story.id}, page ${page.pageNumber}: ${
            err instanceof Error ? err.message : 'Unknown'
          }`,
        );
      }
      return { page: { ...page, audioUrl, finalNarrationText }, costUsd };
    });
    const result = narrated.map((n) => n.page);
    const totalCostUsd = narrated.reduce((sum, n) => sum + n.costUsd, 0);
    return { pages: result, totalCostUsd };
  }

  private normalizeNarrationText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[“”"'.!?—–-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildFinalNarrationText(page: StoryPage): string {
    const base = (page.narrationText || page.text || '').trim();
    if (!base) return '';

    const normalizedBase = this.normalizeNarrationText(base);
    const lines = (page.speechBubbles ?? page.dialogue?.map((d) => ({
      speakerName: d.speaker,
      text: d.text,
    })) ?? [])
      .map((line) => ({
        speaker: line.speakerName?.trim() || 'Someone',
        text: line.text?.trim() ?? '',
      }))
      .filter((line) => line.text.length > 0)
      .filter((line) => {
        const normalizedLine = this.normalizeNarrationText(line.text);
        return normalizedLine.length > 0 && !normalizedBase.includes(normalizedLine);
      });

    if (lines.length === 0) return base;

    return [
      base,
      ...lines.map((line) => `${line.speaker} said, "${line.text}"`),
    ].join('\n');
  }

  private async logStoryGeneration(
    storyId: string,
    userId: string,
    universeId: string | null,
    generated: StoryGenerationOutput,
    isSandbox: boolean,
  ): Promise<number> {
    const provider = generated.provider ?? 'gemini';
    const model = generated.model ?? this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';

    const inputTokens = generated.inputTokens ?? 0;
    const outputTokens = generated.outputTokens ?? 0;
    const inputCostPer1M = await this.getNumberSetting('GEMINI_INPUT_COST_PER_1M_TOKENS', Number(SETTING_DEFAULTS['GEMINI_INPUT_COST_PER_1M_TOKENS'].value));
    const outputCostPer1M = await this.getNumberSetting('GEMINI_OUTPUT_COST_PER_1M_TOKENS', Number(SETTING_DEFAULTS['GEMINI_OUTPUT_COST_PER_1M_TOKENS'].value));
    const estimatedCostUsd = (inputTokens * inputCostPer1M + outputTokens * outputCostPer1M) / 1_000_000;

    await this.aiUsageLogsRepo.save(
      this.aiUsageLogsRepo.create({
        userId,
        storyId,
        universeId,
        provider,
        model,
        operation: AiOperation.StoryGeneration,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        isSandbox,
      }),
    );

    if (generated.prompt && generated.rawResponse) {
      await this.storyGenerationLogsRepo.save(
        this.storyGenerationLogsRepo.create({
          storyId,
          provider,
          model,
          promptKey: generated.promptKey ?? null,
          promptTemplateId: generated.promptTemplateId ?? null,
          promptTemplateVersionId: generated.promptTemplateVersionId ?? null,
          promptVersion: generated.promptVersion ?? null,
          prompt: generated.prompt,
          response: generated.rawResponse,
        }),
      );
    }

    return estimatedCostUsd;
  }

  /** Gives back whatever a failed story cost: the preview for preview stories, otherwise its credits. */
  private async refundStoryCharge(story: Story): Promise<void> {
    if (story.isPreview) {
      await this.usersRepo.increment({ id: story.userId }, 'previewCredits', 1);
    } else if (story.creditsUsed > 0) {
      await this.usersRepo.increment({ id: story.userId }, 'credits', story.creditsUsed);
    }
    await this.creditsRepo.save(
      this.creditsRepo.create({
        userId: story.userId,
        delta: story.isPreview ? 0 : story.creditsUsed,
        reason: CreditTransactionReason.Refund,
        referenceId: story.id,
      }),
    );
  }

  private async getPlanPageCount(plan: string): Promise<number> {
    const keyMap: Record<string, keyof typeof SETTING_DEFAULTS> = {
      basic: 'BASIC_PLAN_PAGES',
      standard: 'STANDARD_PLAN_PAGES',
      premium: 'PREMIUM_PLAN_PAGES',
    };
    const key = keyMap[plan] ?? 'BASIC_PLAN_PAGES';
    return this.getNumberSetting(key, Number(SETTING_DEFAULTS[key].value));
  }

  private async getBooleanSetting(key: keyof typeof SETTING_DEFAULTS, fallback: boolean): Promise<boolean> {
    const row = await this.platformSettingsRepo.findOne({ where: { key } });
    if (row) return row.value === 'true' || row.value === '1';
    const def = SETTING_DEFAULTS[key];
    return def ? def.value === 'true' : fallback;
  }

  private async getStringSetting(key: keyof typeof SETTING_DEFAULTS, fallback: string): Promise<string> {
    const row = await this.platformSettingsRepo.findOne({ where: { key } });
    if (row) return row.value;
    const def = SETTING_DEFAULTS[key];
    return def?.value ?? fallback;
  }

  private async getNumberSetting(key: keyof typeof SETTING_DEFAULTS, fallback: number): Promise<number> {
    const row = await this.platformSettingsRepo.findOne({ where: { key } });
    if (row) return Number(row.value);

    const envAliases: Record<string, string[]> = {
      BASIC_PLAN_PAGES: ['BASIC_PLAN_PAGES'],
      STANDARD_PLAN_PAGES: ['STANDARD_PLAN_PAGES'],
      PREMIUM_PLAN_PAGES: ['PREMIUM_PLAN_PAGES'],
      MAX_IMAGES_PER_STORY_DEV: ['MAX_IMAGES_PER_STORY_DEV'],
      MAX_IMAGES_PER_STORY_PROD: ['MAX_IMAGES_PER_STORY_PROD'],
    };

    for (const envKey of envAliases[key] ?? [key]) {
      const raw = this.config.get<string>(envKey) ?? process.env[envKey];
      if (raw !== undefined && raw !== null) {
        const num = Number(raw);
        if (Number.isFinite(num)) return num;
      }
    }

    return fallback;
  }

  private async buildUniverseContext(story: Story): Promise<UniverseContext | undefined> {
    if (!story.universeId) return undefined;

    const [universe, memories, quests, powers, recentStories, companion, villains] = await Promise.all([
      this.universesRepo.findOne({ where: { id: story.universeId } }),
      this.memoriesRepo.find({ where: { universeId: story.universeId }, order: { createdAt: 'DESC' }, take: 10 }),
      // Only the newest few: a long list of open quests pulled every episode into the same "find the relic" plot.
      this.questsRepo.find({ where: { universeId: story.universeId, status: QuestStatus.Open }, order: { createdAt: 'DESC' }, take: 3 }),
      this.powersRepo.find({ where: { universeId: story.universeId }, order: { createdAt: 'DESC' } }),
      this.storiesRepo.find({
        where: { universeId: story.universeId, userId: story.userId, status: StoryStatus.Completed },
        order: { createdAt: 'DESC' },
        take: 6,
        select: { id: true, title: true, cliffhanger: true, storyVisualState: true },
      }),
      this.companionsRepo.findOne({
        where: { universeId: story.universeId, isActive: true },
        order: { createdAt: 'DESC' },
      }),
      this.villainsRepo.find({ where: { universeId: story.universeId }, order: { updatedAt: 'DESC' } }),
    ]);

    if (!universe) return undefined;

    const lastStory = recentStories[0] ?? null;
    const hasCustomStory = !!story.storyContext;
    const storyShape = hasCustomStory ? null : pickStoryShape(recentStories.map((s) => s.storyVisualState?.storyShape));
    const returningVillain = this.pickReturningVillain(villains, recentStories.map((s) => s.storyVisualState?.villainName));
    if (returningVillain) {
      const escapedIn = villains.find((v) => v.name === returningVillain.name)?.lastStoryId;
      if (escapedIn) {
        returningVillain.lastEpisode = (await this.storiesRepo.findOne({ where: { id: escapedIn }, select: { id: true, title: true } }))?.title ?? null;
      }
    }
    const gear = powers.filter((p) => p.kind === 'artifact');
    const abilities = powers.filter((p) => p.kind !== 'artifact');

    return {
      universeName: universe.name,
      heroTitle: universe.heroTitle,
      recentMemories: memories.map((m) => m.detail ? `${m.title}: ${m.detail}` : m.title),
      openQuests: quests.map((q) => q.title),
      heroPowers: abilities.map((p) => p.emoji ? `${p.emoji} ${p.name}` : p.name),
      heroGear: gear.map((g) => ({ name: g.name, emoji: g.emoji, description: g.description, look: g.look })),
      storyContext: story.storyContext,
      storyMode: story.storyMode,
      lastCliffhanger: lastStory?.cliffhanger ?? null,
      lastStoryTitle: lastStory?.title ?? null,
      recentEpisodes: recentStories
        .filter((s) => s.title)
        .map((s) => ({ title: s.title as string, shape: s.storyVisualState?.storyShape ?? null, villain: s.storyVisualState?.villainName ?? null })),
      storyShape,
      returningVillain,
      pastVillains: villains.filter((v) => v.name !== returningVillain?.name).map((v) => v.name).slice(0, 12),
      companion: companion ? { name: companion.name, type: companion.type } : null,
      visualState: universe.visualState ?? null,
    };
  }

  /**
   * Brings back a villain who escaped — not straight away (they must have been absent for at least
   * one episode) and only now and then, so returning villains feel like an event.
   */
  private pickReturningVillain(
    villains: UniverseVillain[],
    recentVillainNames: Array<string | null | undefined>,
    random: () => number = Math.random,
  ): UniverseContext['returningVillain'] {
    const lastVillain = recentVillainNames[0]?.toLowerCase();
    const candidates = villains.filter((v) => v.status === VillainStatus.Escaped && v.name.toLowerCase() !== lastVillain);
    if (!candidates.length || random() > 0.4) return null;
    const villain = candidates[0];
    return { name: villain.name, look: villain.look, scheme: villain.scheme, lastEpisode: null };
  }

  private async buildSupportingCharacterContext(
    story: Story,
  ): Promise<Array<{ label: string; characterId?: string; avatarUrl: string | null; avatarDescription: string | null; age: number | null }>> {
    const characterIds = story.characterIds ?? [];
    if (characterIds.length === 0) return [];

    const characters = await this.charactersRepo.find({ where: { id: In(characterIds), userId: story.userId } });
    await this.ensureCharacterAvatarDescriptions(characters);

    return characters.map((c) => ({
      label: `${c.name} (${c.role})`,
      characterId: c.id,
      avatarUrl: c.avatarUrl ?? null,
      avatarDescription: c.avatarDescription ?? null,
      age: c.dob ? this.computeAge(c.dob) : null,
    }));
  }

  private async ensureHeroAvatarDescription(hero: Hero): Promise<void> {
    if (hero.avatarDescription || !hero.avatarUrl) return;

    try {
      const description = await this.imageProvider.describeCharacterAppearanceFromUrl(hero.avatarUrl);
      if (!description) return;
      hero.avatarDescription = description;
      await this.heroesRepo.update(hero.id, { avatarDescription: description });
    } catch (err) {
      this.logger.warn(
        `Hero appearance backfill failed for ${hero.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async ensureHeroCharacterIdentity(hero: Hero): Promise<void> {
    if (hero.characterIdentity || !hero.avatarDescription) return;

    try {
      const identity = await this.imageProvider.extractStructuredIdentity(hero.avatarDescription);
      if (!identity) return;
      hero.characterIdentity = identity;
      await this.heroesRepo.update(hero.id, { characterIdentity: identity });
    } catch (err) {
      this.logger.warn(
        `Hero identity extraction failed for ${hero.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async ensureCharacterAvatarDescriptions(characters: Character[]): Promise<void> {
    for (const character of characters) {
      if (character.avatarDescription || !character.avatarUrl) continue;

      try {
        const description = await this.imageProvider.describeCharacterAppearanceFromUrl(character.avatarUrl);
        if (!description) continue;
        character.avatarDescription = description;
        await this.charactersRepo.update(character.id, { avatarDescription: description });
      } catch (err) {
        this.logger.warn(
          `Character appearance backfill failed for ${character.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  // Change 3: Prefix each character's first mention in a scene description with their age.
  private prefixAgesInSceneDescription(
    desc: string,
    heroName: string,
    heroAge: number,
    supportingChars: Array<{ name: string; age: number | null }>,
  ): string {
    let result = desc;
    const heroPattern = new RegExp(`\\b(${heroName})\\b`);
    result = result.replace(heroPattern, `${heroAge}-year-old $1`);
    for (const { name, age } of supportingChars) {
      if (!age || age <= 0) continue;
      const pattern = new RegExp(`\\b(${name})\\b`);
      result = result.replace(pattern, `${age}-year-old $1`);
    }
    return result;
  }

  // Change 4: Rewrite adult-coded costume vocabulary to child-coded equivalents.
  private rewriteChildCostume(costume: string, age: number): string {
    if (age >= 13) return costume;
    if (/child.?sized|kid.?size|play |mini |little |costume/i.test(costume)) return costume;
    return `child-sized ${costume}`;
  }

  private computeAge(dob: string): number {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const beforeBirthday =
      today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
    if (beforeBirthday) age -= 1;
    return age;
  }

  private buildFaceMetricsSummary(metrics: FaceMetricsJson | null | undefined): string {
    if (!metrics) return '';
    const parts = [
      metrics.overall_face_silhouette ? `${metrics.overall_face_silhouette} face silhouette` : '',
      metrics.face_width_category ? `${metrics.face_width_category}-width face` : '',
      metrics.eye_size_category ? `${metrics.eye_size_category} eyes` : '',
      metrics.cheek_fullness_category ? `${metrics.cheek_fullness_category} cheeks` : '',
      metrics.chin_shape ? `${metrics.chin_shape} chin` : '',
    ].filter(Boolean);
    return parts.join(', ');
  }

  private async buildCharacterBibles(
    supportingChars: Array<{ label: string; characterId?: string }>,
  ): Promise<string[]> {
    if (supportingChars.length === 0) return [];
    const charIds = supportingChars.map((c) => c.characterId).filter((id): id is string => !!id);
    if (charIds.length === 0) return supportingChars.map(() => '');

    const [characters, profiles] = await Promise.all([
      this.charactersRepo.find({ where: { id: In(charIds) } }),
      this.visualProfilesRepo.find({ where: { characterId: In(charIds) } }),
    ]);

    const charMap = new Map(characters.map((c) => [c.id, c]));
    const profileMap = new Map(profiles.map((p) => [p.characterId, p]));

    return supportingChars.map((sc) => {
      if (!sc.characterId) return '';
      const char = charMap.get(sc.characterId);
      const profile = profileMap.get(sc.characterId);
      if (!char) return '';

      const lines: string[] = [];
      const nameUpper = char.name.toUpperCase();

      if (char.relationship) lines.push(`Relationship to main character (the hero): ${char.relationship}`);
      if (profile?.costumeDescription) lines.push(`ALWAYS WEARS: ${profile.costumeDescription}`);
      if (profile?.hairDescription) lines.push(`Hair: ${profile.hairDescription}`);
      if (profile?.skinTone) lines.push(`Skin: ${profile.skinTone}`);
      if (profile?.eyeDescription) lines.push(`Eyes: ${profile.eyeDescription}`);
      if (profile?.accessories) lines.push(`Accessories: ${profile.accessories}`);
      if (profile?.colors) lines.push(`Signature colors: ${profile.colors}`);
      if (profile?.doNotChangeRules) lines.push(`NEVER CHANGE: ${profile.doNotChangeRules}`);

      if (lines.length === 0) return '';
      return `${nameUpper} CHARACTER BIBLE:\n${lines.map((l) => `- ${l}`).join('\n')}`;
    });
  }

  private async buildCharacterCanonData(
    story: Story,
    supportingChars: Array<{ label: string; characterId?: string; avatarUrl: string | null; avatarDescription: string | null }>,
  ): Promise<{ summaries: string[]; neverChangeRules: (string[] | null)[] }> {
    const results = await Promise.all(
      supportingChars.map(async (c) => {
        if (!c.characterId) return { summary: c.avatarDescription ?? '', rules: null };
        const canon = await this.characterCanonService.ensureCanonExists({
          characterId: c.characterId,
          userId: story.userId,
          avatarUrl: c.avatarUrl,
          canonType: 'supporting_character',
        }).catch(() => null);
        return {
          summary: canon?.appearanceSummary ?? c.avatarDescription ?? '',
          rules: canon?.neverChangeRulesJson ?? null,
        };
      }),
    );
    return {
      summaries: results.map((r) => r.summary),
      neverChangeRules: results.map((r) => r.rules),
    };
  }

  private precomputePageStateMaps(
    pages: Array<{
      pageNumber: number;
      storyStateUpdate?: {
        newItems?: string[];
        removedItems?: string[];
        newPowers?: string[];
        removedPowers?: string[];
        newCompanions?: string[];
        removedCompanions?: string[];
        locationChange?: string;
        costumeChange?: string;
      };
    }>,
    storyVisualState: StoryVisualState | null,
  ): {
    pageStateBlockMap: Map<number, string>;
    pageStateSnapshotMap: Map<number, { location?: string; costume?: string; items: string[]; powers: string[]; companions: string[] }>;
  } {
    const tracker = new StoryStateTracker(storyVisualState);
    const pageStateBlockMap = new Map<number, string>();
    const pageStateSnapshotMap = new Map<number, { location?: string; costume?: string; items: string[]; powers: string[]; companions: string[] }>();

    for (const page of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
      pageStateBlockMap.set(page.pageNumber, tracker.toImageStateBlock());
      pageStateSnapshotMap.set(page.pageNumber, tracker.toStateSnapshot());
      tracker.applyUpdate(page.storyStateUpdate);
    }

    return { pageStateBlockMap, pageStateSnapshotMap };
  }

  private normalizeGeneratedStory(
    generated: StoryGenerationOutput,
    heroName: string,
    existingVisualState: StoryVisualState | null,
  ): StoryGenerationOutput {
    const resolveBubblePlacement = (
      bubble: NonNullable<StoryPage['speechBubbles']>[number],
      page: {
        characterDirections?: StoryPage['characterDirections'];
      },
      index: number,
    ): SpeechBubbleMetadata => {
      const speaker = (bubble.speakerName?.trim()) || heroName;
      const bubbleStyle = (bubble.bubbleStyle ?? 'normal') as SpeechBubbleStyle;
      const firstName = speaker.toLowerCase().split(/\s+/)[0];
      const direction = page.characterDirections?.find((c) => {
        const name = c.name.toLowerCase();
        return name === speaker.toLowerCase() || name.split(/\s+/)[0] === firstName;
      });
      const position = direction?.position ?? (index % 2 === 0 ? 'left' : 'right');

      if (position === 'right') {
        return {
          ...bubble,
          speakerName: speaker,
          bubbleStyle,
          preferredPosition: bubble.preferredPosition ?? 'top-left',
          tailDirection: bubble.tailDirection ?? 'down-right',
          anchor: bubble.anchor ?? 'lower_face',
          anchorTarget: bubble.anchorTarget ?? 'lower_face',
          avoidCovering: bubble.avoidCovering?.length ? bubble.avoidCovering : ['face', 'mouth'],
          maxWidthPercent: bubble.maxWidthPercent ?? 42,
        };
      }

      if (position === 'center' || position === 'foreground') {
        const left = index % 2 === 0;
        return {
          ...bubble,
          speakerName: speaker,
          bubbleStyle,
          preferredPosition: bubble.preferredPosition ?? (left ? 'top-left' : 'top-right'),
          tailDirection: bubble.tailDirection ?? (left ? 'down-right' : 'down-left'),
          anchor: bubble.anchor ?? 'lower_face',
          anchorTarget: bubble.anchorTarget ?? 'lower_face',
          avoidCovering: bubble.avoidCovering?.length ? bubble.avoidCovering : ['face', 'mouth'],
          maxWidthPercent: bubble.maxWidthPercent ?? 40,
        };
      }

      return {
        ...bubble,
        speakerName: speaker,
        bubbleStyle,
        preferredPosition: bubble.preferredPosition ?? 'top-right',
        tailDirection: bubble.tailDirection ?? 'down-left',
        anchor: bubble.anchor ?? 'lower_face',
        anchorTarget: bubble.anchorTarget ?? 'lower_face',
        avoidCovering: bubble.avoidCovering?.length ? bubble.avoidCovering : ['face', 'mouth'],
        maxWidthPercent: bubble.maxWidthPercent ?? 42,
      };
    };

    const normalizePage = (page: {
      pageNumber: number;
      text: string;
      narrationText?: string;
      sceneDescription: string;
      dialogue?: PageDialogue[];
      characters?: PageCharacter[];
      camera?: string;
      cropHint?: string;
      background?: string;
      characterDirections?: StoryPage['characterDirections'];
      speechBubbles?: StoryPage['speechBubbles'];
      storyStateUpdate?: StoryPage['storyStateUpdate'];
    }) => ({
      ...page,
      narrationText: page.narrationText ?? page.text,
      // Validate and sanitize speech bubbles: reject any without speakerName or text
      // Fall back to hero name if speakerName is missing but text is non-empty
      speechBubbles: (() => {
        const rawBubbles = (page.speechBubbles ?? []).length > 0
          ? page.speechBubbles!
          : (page.dialogue ?? []).map((d) => ({
              speakerName: d.speaker,
              text: d.text,
              emotion: d.emotion,
              bubbleStyle: d.bubbleStyle,
              placementHint: d.placementHint,
            }));

        return rawBubbles
          .map((b, index) => resolveBubblePlacement({
            ...b,
            speakerName: (b.speakerName?.trim()) || heroName,
            bubbleStyle: (b.bubbleStyle ?? 'normal') as SpeechBubbleStyle,
          }, page, index))
          .filter((b) => b.text?.trim());
      })(),
      // dialogue: derive from speechBubbles (single source of truth after normalization)
      dialogue: (() => {
        const rawBubbles = (page.speechBubbles ?? []).length > 0
          ? page.speechBubbles!
          : (page.dialogue ?? []).map((d) => ({
              speakerName: d.speaker,
              text: d.text,
              emotion: d.emotion,
              bubbleStyle: d.bubbleStyle,
              placementHint: d.placementHint,
            }));

        return rawBubbles
          .map((b) => ({
            speaker: (b.speakerName?.trim()) || heroName,
            text: b.text,
            emotion: (b as { emotion?: string }).emotion,
            bubbleStyle: (b.bubbleStyle ?? 'normal') as PageDialogue['bubbleStyle'],
            placementHint: (b as { placementHint?: string }).placementHint,
          }))
          .filter((d) => d.text?.trim());
      })(),
      characters: page.characters?.length
        ? page.characters
        : [{ name: heroName, expression: 'focused', pose: 'in action' }],
      camera: page.camera ?? 'medium shot',
      background: page.background ?? page.sceneDescription,
      cropHint: page.cropHint ?? 'full_width',
      characterDirections: page.characterDirections ?? [{
        name: heroName,
        role: 'hero',
        expression: 'focused expression, alert eyes',
        pose: 'in action',
      }],
      storyStateUpdate: page.storyStateUpdate ?? {
        newItems: [],
        removedItems: [],
        newPowers: [],
        removedPowers: [],
        newCompanions: [],
        removedCompanions: [],
        locationChange: undefined,
        costumeChange: undefined,
      },
    });

    const normalizedScenes = generated.scenes?.map((scene) => ({
      ...scene,
      illustrationBrief: scene.illustrationBrief || scene.pages[0]?.sceneDescription || 'Wide cinematic illustration',
      pages: scene.pages.map(normalizePage),
    }));

    const flatPages = normalizedScenes?.length
      ? normalizedScenes
          .flatMap((scene) =>
            scene.pages.map((p) => ({
              ...p,
              sceneDescription: p.sceneDescription ?? scene.illustrationBrief,
              sceneId: scene.sceneId,
            })),
          )
          .sort((a, b) => a.pageNumber - b.pageNumber)
      : generated.pages.map(normalizePage);

    return {
      ...generated,
      storyVisualState: generated.storyVisualState ?? (existingVisualState
        ? {
            costume: existingVisualState.costume,
            companion: existingVisualState.companion,
            weapon: existingVisualState.weapon,
            powers: existingVisualState.powers,
            inventory: existingVisualState.inventory,
          }
        : undefined),
      scenes: normalizedScenes,
      pages: flatPages,
    };
  }

  private async persistUniverseExtracts(story: Story, generated: StoryGenerationOutput): Promise<void> {
    if (!story.universeId) return;

    const validMemoryTypes = new Set<string>(Object.values(MemoryType));
    const memories = (generated.newMemories ?? [])
      .filter((m) => m && typeof m === 'object' && validMemoryTypes.has(m.type))
      .map((m) => {
        const title = typeof m.title === 'string' && m.title.trim() ? m.title.trim() : null;
        if (!title) return null;
        return this.memoriesRepo.create({
          universeId: story.universeId as string,
          type: m.type as MemoryType,
          title,
          detail: typeof m.detail === 'string' ? m.detail : null,
          storyId: story.id,
        });
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
    if (memories.length > 0) await this.memoriesRepo.save(memories);

    // Collect power names from three sources:
    // 1. Top-level newPowers[] — the canonical field
    // 2. power_earned entries in newMemories — Gemini sometimes puts them only here
    // 3. Per-page storyStateUpdate.newPowers — Gemini sometimes puts them only in page state
    const powerNamesFromMemories = (generated.newMemories ?? [])
      .filter((m) => m?.type === MemoryType.PowerEarned && typeof m.title === 'string' && m.title.trim())
      .map((m) => m.title.trim());
    const powerNamesFromPages = (generated.pages ?? [])
      .flatMap((p) => p.storyStateUpdate?.newPowers ?? [])
      .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
      .map((name) => name.trim());
    const allPowerNames = Array.from(new Set([
      ...(generated.newPowers ?? []).map((p) => this.textField(p, 'name').title).filter((n): n is string => !!n),
      ...powerNamesFromMemories,
      ...powerNamesFromPages,
    ]));
    // The structured reward (usually a physical artifact) carries its kind, emoji, description and look.
    const reward = generated.reward && typeof generated.reward === 'object' ? generated.reward : null;
    const rewardName = typeof reward?.name === 'string' ? reward.name.trim() : '';
    const owned = new Set(
      (await this.powersRepo.find({ where: { universeId: story.universeId }, select: { name: true } })).map((p) => p.name.toLowerCase()),
    );
    const newPowers: HeroPower[] = [];
    if (rewardName && !owned.has(rewardName.toLowerCase())) {
      const detail = (generated.newMemories ?? []).find((m) => m?.type === MemoryType.PowerEarned && m.title?.trim().toLowerCase() === rewardName.toLowerCase())?.detail;
      newPowers.push(this.powersRepo.create({
        universeId: story.universeId,
        name: rewardName,
        kind: reward?.kind === 'power' ? 'power' : 'artifact',
        emoji: typeof reward?.emoji === 'string' && reward.emoji.trim() ? reward.emoji.trim().slice(0, 8) : null,
        description: (typeof reward?.description === 'string' && reward.description.trim()) || detail || null,
        look: typeof reward?.look === 'string' && reward.look.trim() ? reward.look.trim() : null,
        earnedInStoryId: story.id,
      }));
      owned.add(rewardName.toLowerCase());
    }
    for (const name of allPowerNames) {
      if (owned.has(name.toLowerCase())) continue;
      owned.add(name.toLowerCase());
      newPowers.push(this.powersRepo.create({ universeId: story.universeId, name, kind: 'power', description: null, emoji: null, look: null, earnedInStoryId: story.id }));
    }
    if (newPowers.length > 0) await this.powersRepo.save(newPowers);

    await this.recordVillain(story, generated);
    await this.closeCompletedQuests(story, generated);

    // The writer sometimes returns { title, detail } objects instead of strings — they were saved as raw JSON.
    const quests = (generated.newQuests ?? [])
      .map((q) => this.textField(q, 'title'))
      .filter((q) => !!q.title)
      .map(({ title, detail }) =>
        this.questsRepo.create({ universeId: story.universeId as string, title: title!, description: detail, openedInStoryId: story.id, completedInStoryId: null }),
      );
    if (quests.length > 0) await this.questsRepo.save(quests);
  }

  /** Saves this episode's villain, or updates them if they've appeared before (so they can return). */
  private async recordVillain(story: Story, generated: StoryGenerationOutput): Promise<void> {
    const v = generated.villain && typeof generated.villain === 'object' ? generated.villain : null;
    const name = typeof v?.name === 'string' ? v.name.trim() : '';
    if (!name || !story.universeId) return;
    const outcomes = Object.values(VillainStatus) as string[];
    const status = (outcomes.includes(String(v?.outcome)) ? v?.outcome : VillainStatus.Defeated) as VillainStatus;
    const look = (typeof v?.look === 'string' && v.look.trim()) || generated.storyVisualState?.characterLooks?.[name] || null;
    const scheme = typeof v?.scheme === 'string' && v.scheme.trim() ? v.scheme.trim() : null;

    const existing = await this.villainsRepo
      .createQueryBuilder('v')
      .where('v.universeId = :universeId AND LOWER(v.name) = LOWER(:name)', { universeId: story.universeId, name })
      .getOne();
    if (existing) {
      existing.status = status;
      existing.appearances += 1;
      existing.lastStoryId = story.id;
      existing.scheme = scheme ?? existing.scheme;
      existing.look = existing.look ?? look; // the first look sticks so they're recognisable
      await this.villainsRepo.save(existing);
      return;
    }
    await this.villainsRepo.save(this.villainsRepo.create({
      universeId: story.universeId, name, look, scheme, status, appearances: 1, firstStoryId: story.id, lastStoryId: story.id,
    }));
  }

  /** Quests were opened every episode but never closed — mark the ones this story resolved. */
  private async closeCompletedQuests(story: Story, generated: StoryGenerationOutput): Promise<void> {
    if (!story.universeId) return;
    const titles = new Set([
      ...(generated.questsCompleted ?? []),
      ...(generated.newMemories ?? []).filter((m) => m?.type === MemoryType.QuestCompleted).map((m) => m.title),
    ].filter((t): t is string => typeof t === 'string' && !!t.trim()).map((t) => t.trim().toLowerCase().replace(/[.!]+$/, '')));
    if (!titles.size) return;
    const open = await this.questsRepo.find({ where: { universeId: story.universeId, status: QuestStatus.Open } });
    const done = open.filter((q) => titles.has(q.title.trim().toLowerCase().replace(/[.!]+$/, '')));
    if (!done.length) return;
    await this.questsRepo.save(done.map((q) => ({ ...q, status: QuestStatus.Completed, completedInStoryId: story.id })));
  }

  /** Accepts a plain string or a { title|name, detail|description } object from the writer. */
  private textField(value: unknown, key: 'title' | 'name'): { title: string | null; detail: string | null } {
    if (typeof value === 'string') return { title: value.trim() || null, detail: null };
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      const title = [v[key], v.title, v.name].find((x): x is string => typeof x === 'string' && !!x.trim());
      const detail = [v.detail, v.description].find((x): x is string => typeof x === 'string' && !!x.trim());
      return { title: title?.trim() ?? null, detail: detail?.trim() ?? null };
    }
    return { title: null, detail: null };
  }
}

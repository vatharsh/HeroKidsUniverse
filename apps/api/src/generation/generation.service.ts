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
import { CharacterCanonService } from '../characters/character-canon.service';
import type { FaceMetricsJson } from '../characters/entities/character-canon.entity';
import { Character } from '../characters/entities/character.entity';
import { UniverseCompanion } from '../companions/entities/universe-companion.entity';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { Hero } from '../heroes/hero.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Quest, QuestStatus } from '../quests/quest.entity';
import { Story, StoryMode, StoryPage, StoryScene, StoryStatus, StoryTheme, StoryVisualState } from '../stories/story.entity';
import { ArcStatus, StoryArc } from '../story-arcs/story-arc.entity';
import { MemoryType, UniverseMemory } from '../universes/universe-memory.entity';
import { Universe } from '../universes/universe.entity';
import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { User } from '../users/user.entity';
import { UploadService } from '../upload/upload.service';
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
    @InjectRepository(Character) private readonly charactersRepo: Repository<Character>,
    @InjectRepository(UniverseCompanion) private readonly companionsRepo: Repository<UniverseCompanion>,
    @InjectRepository(AiUsageLog) private readonly aiUsageLogsRepo: Repository<AiUsageLog>,
    @InjectRepository(StoryGenerationLog) private readonly storyGenerationLogsRepo: Repository<StoryGenerationLog>,
    @InjectRepository(StoryGenerationCost) private readonly storyGenerationCostsRepo: Repository<StoryGenerationCost>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(StoryArc) private readonly storyArcsRepo: Repository<StoryArc>,
    @InjectRepository(CreditTransaction) private readonly creditsRepo: Repository<CreditTransaction>,
    @InjectRepository(GenerationJob) private readonly jobsRepo: Repository<GenerationJob>,
    @InjectRepository(PlatformSetting) private readonly platformSettingsRepo: Repository<PlatformSetting>,
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
            // Refund the credit
            await this.usersRepo.increment({ id: s.userId }, 'credits', 1);
            await this.creditsRepo.save(
              this.creditsRepo.create({ userId: s.userId, delta: 1, reason: CreditTransactionReason.Refund, referenceId: s.id }),
            );
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
      let existingVisualState: StoryVisualState | null = null;
      if (story.universeId && story.storyMode !== StoryMode.NewAdventure) {
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
      }

      const companionLabel = universeContext?.companion
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
      const characterCanonSummaries = canonEnabled
        ? await this.buildCharacterCanonSummaries(story, supportingChars)
        : supportingChars.map((c) => c.avatarDescription ?? '');

      const heroAge = this.computeAge(hero.dob);
      const heroName = hero.name ?? 'Hero';
      const heroGender = hero.gender ?? 'child';

      const storyUser = await this.usersRepo.findOne({ where: { id: userId } });
      const pageCount = await this.getPlanPageCount(storyUser?.plan ?? 'basic');

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
        universeContext,
        storyContext: story.storyContext ?? undefined,
        storyVisualState: existingVisualState,
      });
      const normalizedGenerated = this.normalizeGeneratedStory(generated, heroName, existingVisualState);

      let storyVisualState: StoryVisualState | null = null;
      if (normalizedGenerated.storyVisualState) {
        storyVisualState = {
          costume: normalizedGenerated.storyVisualState.costume,
          companion: normalizedGenerated.storyVisualState.companion,
          weapon: normalizedGenerated.storyVisualState.weapon,
          powers: normalizedGenerated.storyVisualState.powers ?? [],
          inventory: normalizedGenerated.storyVisualState.inventory ?? [],
          transformation: null,
        };
      } else if (universeContext) {
        storyVisualState = {
          costume: universeContext.visualState?.costume ?? null,
          companion: universeContext.companion ? `${universeContext.companion.name} (${universeContext.companion.type})` : null,
          weapon: universeContext.visualState?.weapon ?? null,
          powers: universeContext.heroPowers ?? [],
          inventory: universeContext.heroPowers ?? [],
          transformation: null,
        };
      }

      if (storyVisualState) {
        await this.storiesRepo.update(storyId, { storyVisualState });
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
        await this.usersRepo.increment({ id: userId }, 'credits', 1);
        await this.creditsRepo.save(
          this.creditsRepo.create({
            userId,
            delta: 1,
            reason: CreditTransactionReason.StoryGeneration,
            referenceId: storyId,
          }),
        );
      } catch (refundErr) {
        this.logger.error(`Credit refund failed for user ${userId}, story ${storyId}`, refundErr);
      }
    }
  }

  async getActiveJobs(userId: string): Promise<GenerationJob[]> {
    return this.jobsRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
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
    onPageDone?: (pageNum: number, total: number) => Promise<void>,
  ): Promise<{ pages: StoryPage[]; totalCostUsd: number }> {
    const mode = this.config.get<string>('IMAGE_GENERATION_MODE') ?? 'full_generation';
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

    const imageModel = this.config.get<string>('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
    const costPerImage = await this.getNumberSetting('OPENAI_IMAGE_COST_PER_IMAGE', Number(SETTING_DEFAULTS['OPENAI_IMAGE_COST_PER_IMAGE'].value));
    const faceQAEnabled = await this.getBooleanSetting('FACE_CONSISTENCY_QA_ENABLED', true);
    const faceQAThreshold = await this.getNumberSetting('FACE_CONSISTENCY_THRESHOLD', 7);

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
            sceneDescription: page.sceneDescription,
            heroName,
            heroAge,
            supportingCharacters,
            heroAvatarUrl: hero.avatarUrl ?? undefined,
            heroAvatarDescription: hero.avatarDescription ?? undefined,
            characterAvatarUrls,
            characterAvatarDescriptions,
            style: 'premium semi-realistic children\'s storybook illustration, warm painterly lighting, identity-faithful faces, rich colorful backgrounds, Indian family warmth, no Pixar/anime/Disney facial exaggeration, no generic cartoon child',
            storyVisualState: storyVisualState ?? undefined,
            dialogue: page.dialogue,
            characters: page.characters,
            camera: page.camera,
            heroCanonSummary,
            heroNeverChangeRules,
            heroFaceMetrics,
            characterCanonSummaries,
            storyStateBlock: pageStateBlockMap.get(page.pageNumber) ?? undefined,
            characterDirections: page.characterDirections,
          };
          let imageOutput = await this.generateImageWithRetry(imageInput);

          if (faceQAEnabled && hero.avatarUrl && imageOutput.imageBase64) {
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
            provider: 'openai',
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
      const speechBubbles = await this.enrichSpeechBubbleLayout({
        pageNumber: page.pageNumber,
        imageUrl,
        imageBase64: imageOutput.imageBase64,
        sceneDescription: page.sceneDescription,
        characterDirections: page.characterDirections,
        speechBubbles: page.speechBubbles,
      });

      pages.push({
        pageNumber: page.pageNumber,
        text: page.text,
        narrationText: page.narrationText,
        imageUrl,
        audioUrl: undefined,
        sceneDescription: page.sceneDescription,
        dialogue: page.dialogue,
        characters: page.characters,
        camera: page.camera,
        cropHint: page.cropHint,
        sceneId: page.sceneId,
        background: page.background,
        speechBubbles,
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
    onPageDone?: (pageNum: number, total: number) => Promise<void>,
  ): Promise<{ pages: StoryPage[]; scenes: StoryScene[]; totalCostUsd: number }> {
    const scenes = generated.scenes ?? [];
    const imageModel = this.config.get<string>('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
    const costPerImage = await this.getNumberSetting(
      'OPENAI_IMAGE_COST_PER_IMAGE',
      Number(SETTING_DEFAULTS['OPENAI_IMAGE_COST_PER_IMAGE'].value),
    );
    const faceQAEnabled = await this.getBooleanSetting('FACE_CONSISTENCY_QA_ENABLED', true);
    const faceQAThreshold = await this.getNumberSetting('FACE_CONSISTENCY_THRESHOLD', 7);
    let totalCostUsd = 0;
    let settled = 0;

    const mode = this.config.get<string>('IMAGE_GENERATION_MODE') ?? 'full_generation';

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

    const sceneResults: SceneResult[] = await this.mapWithConcurrency(
      illustratedScenes,
      2,
      async (scene): Promise<SceneResult> => {
        try {
          const firstPage = scene.pages[0];
          const imageInput: ImageGenerationInput = {
            sceneDescription: scene.illustrationBrief,
            heroName,
            heroAge,
            supportingCharacters,
            heroAvatarUrl: hero.avatarUrl ?? undefined,
            heroAvatarDescription: hero.avatarDescription ?? undefined,
            characterAvatarUrls,
            characterAvatarDescriptions,
            style: 'premium wide-format semi-realistic children\'s storybook illustration, warm painterly lighting, identity-faithful faces, rich colorful environments with ample clean space for app-rendered speech bubbles, Indian family warmth, no Pixar/anime/Disney facial exaggeration, no generic cartoon child',
            storyVisualState: storyVisualState ?? undefined,
            characters: firstPage?.characters,
            camera: 'wide cinematic composition, characters positioned with generous background space on all sides for flexible cropping',
            heroCanonSummary,
            heroNeverChangeRules,
            heroFaceMetrics,
            characterCanonSummaries,
            storyStateBlock: sceneStateBlockMap.get(scene.sceneId) ?? undefined,
            characterDirections: firstPage?.characterDirections,
          };
          let imageOutput = await this.generateImageWithRetry(imageInput);

          if (faceQAEnabled && hero.avatarUrl && imageOutput.imageBase64) {
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

          settled++;
          if (onPageDone) await onPageDone(settled, illustratedScenes.length).catch(() => {});
          return { scene, imageOutput };
        } catch (err) {
          settled++;
          if (onPageDone) await onPageDone(settled, illustratedScenes.length).catch(() => {});
          return { scene, imageOutput: null, error: err instanceof Error ? err.message : 'Unknown' };
        }
      },
    );

    const sceneIllustrationMap = new Map<string, string | undefined>();
    const storedScenes: StoryScene[] = [];

    for (const { scene, imageOutput, error } of sceneResults) {
      if (!imageOutput) {
        this.logger.warn(`Scene image gen failed for story ${story.id}, scene ${scene.sceneId}: ${error ?? 'Unknown'}`);
        sceneIllustrationMap.set(scene.sceneId, undefined);
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
        illustrationUrl = imageOutput.imageBase64
          ? await this.uploadService.uploadGeneratedImage(story.userId, story.id, fileKey, imageOutput.imageBase64)
          : imageOutput.imageUrl || undefined;

        totalCostUsd += costPerImage;
        await this.aiUsageLogsRepo.save(
          this.aiUsageLogsRepo.create({
            userId: story.userId,
            storyId: story.id,
            universeId: story.universeId ?? null,
            provider: 'openai',
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
      storedScenes.push({
        sceneId: scene.sceneId,
        title: scene.title,
        illustrationUrl: null,
        illustrationBrief: scene.illustrationBrief,
        pageNumbers: scene.pages.map((p) => p.pageNumber),
      });
    }

    const pages: StoryPage[] = [];
    for (const scene of scenes) {
      const sceneImageUrl = sceneIllustrationMap.get(scene.sceneId);
      const firstPageNumber = scene.pages[0]?.pageNumber;

      for (const page of scene.pages) {
        let pageImageUrl = sceneImageUrl;
        let pageImageBase64: string | undefined;
        const needsPageSpecificExpression =
          page.pageNumber !== firstPageNumber &&
          ((page.speechBubbles?.length ?? 0) > 0 ||
            page.characterDirections?.some((c) => c.isSpeaking || c.mouthState === 'speaking'));

        if (sceneImageUrl && needsPageSpecificExpression) {
          try {
            const imageInput: ImageGenerationInput = {
              sceneDescription: page.sceneDescription || scene.illustrationBrief,
              heroName,
              heroAge,
              supportingCharacters,
              heroAvatarUrl: hero.avatarUrl ?? undefined,
              heroAvatarDescription: hero.avatarDescription ?? undefined,
              characterAvatarUrls,
              characterAvatarDescriptions,
              style: 'premium semi-realistic children\'s storybook illustration, warm painterly lighting, identity-faithful faces, rich colorful backgrounds, clean space for app-rendered speech bubbles, Indian family warmth, no Pixar/anime/Disney facial exaggeration, no generic cartoon child',
              storyVisualState: storyVisualState ?? undefined,
              dialogue: page.dialogue,
              characters: page.characters,
              camera: page.camera ?? 'medium shot with face clearly visible',
              heroCanonSummary,
              heroNeverChangeRules,
              heroFaceMetrics,
              characterCanonSummaries,
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
                provider: 'openai',
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

        const speechBubbles = await this.enrichSpeechBubbleLayout({
          pageNumber: page.pageNumber,
          imageUrl: pageImageUrl,
          imageBase64: pageImageBase64,
          sceneDescription: page.sceneDescription,
          characterDirections: page.characterDirections,
          speechBubbles: page.speechBubbles,
        });

        pages.push({
          pageNumber: page.pageNumber,
          text: page.text,
          narrationText: page.narrationText,
          imageUrl: pageImageUrl,
          audioUrl: undefined,
          sceneDescription: page.sceneDescription,
          dialogue: page.dialogue,
          characters: page.characters,
          camera: page.camera,
          cropHint: page.cropHint,
          sceneId: scene.sceneId,
          background: page.background,
          speechBubbles,
          storyStateSnapshot: pageStateSnapshotMap.get(page.pageNumber),
          characterDirections: page.characterDirections,
          storyStateUpdate: page.storyStateUpdate,
        });
      }
    }

    pages.sort((a, b) => a.pageNumber - b.pageNumber);

    return { pages, scenes: storedScenes, totalCostUsd };
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

  private async generatePageAudio(story: Story, pages: StoryPage[], isSandbox: boolean): Promise<{ pages: StoryPage[]; totalCostUsd: number }> {
    const result: StoryPage[] = [];
    let totalCostUsd = 0;
    const ttsCostPerChar = await this.getNumberSetting('OPENAI_TTS_COST_PER_CHAR', Number(SETTING_DEFAULTS['OPENAI_TTS_COST_PER_CHAR'].value));
    const ttsVoice = await this.getStringSetting('TTS_VOICE', 'nova');
    const ttsSpeed = await this.getNumberSetting('TTS_SPEED_RATIO', 0.9);
    const ttsAccentStyle = await this.getStringSetting('TTS_ACCENT_STYLE', 'indian_english');
    const ttsTone = await this.getStringSetting('TTS_TONE', 'warm_bedtime_story');
    const enableIndianEnglish = await this.getBooleanSetting('ENABLE_INDIAN_ENGLISH_NARRATION', true);
    const narrationLanguage = enableIndianEnglish ? 'en-IN' : 'en-US';
    const narrationAccent = enableIndianEnglish
      ? ttsAccentStyle.replace(/_/g, ' ')
      : 'neutral English';
    const narrationTone = ttsTone.replace(/_/g, ' ');

    for (const page of pages) {
      let audioUrl: string | undefined;
      const finalNarrationText = this.buildFinalNarrationText(page);
      try {
        const narration = await this.narrationProvider.generateNarration({
          text: finalNarrationText,
          voice: ttsVoice,
          speed: ttsSpeed,
          language: narrationLanguage,
          accent: narrationAccent,
          tone: narrationTone,
          audience: 'children',
        });
        if (narration.audioBuffer) {
          audioUrl = await this.uploadService.uploadPageAudio(
            story.userId,
            story.id,
            page.pageNumber,
            narration.audioBuffer,
          );
        }

        const estimatedSeconds = Math.max(5, Math.ceil(finalNarrationText.split(/\s+/).filter(Boolean).length * 0.55));
        const pageCostUsd = finalNarrationText.length * ttsCostPerChar;
        totalCostUsd += pageCostUsd;
        await this.aiUsageLogsRepo.save(
          this.aiUsageLogsRepo.create({
            userId: story.userId,
            storyId: story.id,
            universeId: story.universeId ?? null,
            provider: 'openai',
            model: this.config.get<string>('OPENAI_TTS_MODEL') ?? 'gpt-4o-mini-tts',
            operation: AiOperation.Narration,
            audioSeconds: estimatedSeconds,
            estimatedCostUsd: pageCostUsd,
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
      result.push({ ...page, audioUrl, finalNarrationText });
    }
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

    const [universe, memories, quests, powers, lastStory, companion] = await Promise.all([
      this.universesRepo.findOne({ where: { id: story.universeId } }),
      this.memoriesRepo.find({ where: { universeId: story.universeId }, order: { createdAt: 'DESC' }, take: 10 }),
      this.questsRepo.find({ where: { universeId: story.universeId, status: QuestStatus.Open }, order: { createdAt: 'DESC' } }),
      this.powersRepo.find({ where: { universeId: story.universeId }, order: { createdAt: 'DESC' } }),
      this.storiesRepo.findOne({
        where: { universeId: story.universeId, userId: story.userId, status: StoryStatus.Completed },
        order: { createdAt: 'DESC' },
      }),
      this.companionsRepo.findOne({
        where: { universeId: story.universeId, isActive: true },
        order: { createdAt: 'DESC' },
      }),
    ]);

    if (!universe) return undefined;

    return {
      universeName: universe.name,
      heroTitle: universe.heroTitle,
      recentMemories: memories.map((m) => m.detail ? `${m.title}: ${m.detail}` : m.title),
      openQuests: quests.map((q) => q.title),
      heroPowers: powers.map((p) => p.emoji ? `${p.emoji} ${p.name}` : p.name),
      storyContext: story.storyContext,
      storyMode: story.storyMode,
      lastCliffhanger: lastStory?.cliffhanger ?? null,
      lastStoryTitle: lastStory?.title ?? null,
      companion: companion ? { name: companion.name, type: companion.type } : null,
      visualState: universe.visualState ?? null,
    };
  }

  private async buildSupportingCharacterContext(
    story: Story,
  ): Promise<Array<{ label: string; characterId?: string; avatarUrl: string | null; avatarDescription: string | null }>> {
    const characterIds = story.characterIds ?? [];
    if (characterIds.length === 0) return [];

    const characters = await this.charactersRepo.find({ where: { id: In(characterIds), userId: story.userId } });
    await this.ensureCharacterAvatarDescriptions(characters);

    return characters.map((c) => ({
      label: `${c.name} (${c.role})`,
      characterId: c.id,
      avatarUrl: c.avatarUrl ?? null,
      avatarDescription: c.avatarDescription ?? null,
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

  private async buildCharacterCanonSummaries(
    story: Story,
    supportingChars: Array<{ label: string; characterId?: string; avatarUrl: string | null; avatarDescription: string | null }>,
  ): Promise<string[]> {
    return Promise.all(
      supportingChars.map(async (c) => {
        if (!c.characterId) return c.avatarDescription ?? '';
        const canon = await this.characterCanonService.ensureCanonExists({
          characterId: c.characterId,
          userId: story.userId,
          avatarUrl: c.avatarUrl,
          canonType: 'supporting_character',
        }).catch(() => null);
        return canon?.appearanceSummary ?? c.avatarDescription ?? '';
      }),
    );
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
      .filter((m) => validMemoryTypes.has(m.type) && !!m.title)
      .map((m) =>
        this.memoriesRepo.create({
          universeId: story.universeId as string,
          type: m.type as MemoryType,
          title: m.title,
          detail: m.detail ?? null,
          storyId: story.id,
        }),
      );
    if (memories.length > 0) await this.memoriesRepo.save(memories);

    const powers = (generated.newPowers ?? []).map((name) =>
      this.powersRepo.create({ universeId: story.universeId as string, name, description: null, emoji: null, earnedInStoryId: story.id }),
    );
    if (powers.length > 0) await this.powersRepo.save(powers);

    const quests = (generated.newQuests ?? []).map((title) =>
      this.questsRepo.create({ universeId: story.universeId as string, title, description: null, openedInStoryId: story.id, completedInStoryId: null }),
    );
    if (quests.length > 0) await this.questsRepo.save(quests);
  }
}

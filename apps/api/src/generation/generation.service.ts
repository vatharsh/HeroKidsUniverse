import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AiOperation, AiUsageLog } from '../ai/entities/ai-usage-log.entity';
import { StoryGenerationCost } from '../ai/entities/story-generation-cost.entity';
import { StoryGenerationLog } from '../ai/entities/story-generation-log.entity';
import { IMAGE_GENERATION_PROVIDER } from '../ai/interfaces/image-generation.provider';
import { NARRATION_PROVIDER } from '../ai/interfaces/narration.provider';
import { STORY_GENERATION_PROVIDER } from '../ai/interfaces/story-generation.provider';
import type { ImageGenerationProvider } from '../ai/interfaces/image-generation.provider';
import type { NarrationProvider } from '../ai/interfaces/narration.provider';
import type { StoryGenerationOutput, StoryGenerationProvider, UniverseContext } from '../ai/interfaces/story-generation.provider';
import { Character } from '../characters/entities/character.entity';
import { UniverseCompanion } from '../companions/entities/universe-companion.entity';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { Hero } from '../heroes/hero.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Quest, QuestStatus } from '../quests/quest.entity';
import { Story, StoryMode, StoryPage, StoryStatus, StoryTheme } from '../stories/story.entity';
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

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(STORY_GENERATION_PROVIDER) private readonly storyProvider: StoryGenerationProvider,
    @Inject(IMAGE_GENERATION_PROVIDER) private readonly imageProvider: ImageGenerationProvider,
    @Inject(NARRATION_PROVIDER) private readonly narrationProvider: NarrationProvider,
    private readonly uploadService: UploadService,
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

  async generateStory(storyId: string, userId: string): Promise<void> {
    const job = await this.jobsRepo.save(
      this.jobsRepo.create({ userId, storyId, status: JobStatus.Queued, progressPercentage: 0 }),
    );

    const updateJob = (patch: Partial<GenerationJob>) => this.jobsRepo.update(job.id, patch);

    try {
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
      const companionLabel = universeContext?.companion
        ? `${universeContext.companion.name} (${universeContext.companion.type} companion)`
        : null;
      const supportingChars = await this.buildSupportingCharacterContext(story);
      const supportingCharLabels = supportingChars.map((c) => c.label);
      if (companionLabel) supportingCharLabels.push(companionLabel);
      const supportingCharAvatars = supportingChars.map((c) => c.avatarUrl).filter((u): u is string => !!u);

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
        themeDescription,
        pageCount,
        supportingCharacters: supportingCharLabels,
        universeContext,
        storyContext: story.storyContext ?? undefined,
      });

      const storyCostUsd = await this.logStoryGeneration(storyId, userId, story.universeId ?? null, generated);

      let arcId: string | null = null;
      if (story.universeId) {
        if (story.storyMode === StoryMode.NewArc) {
          const arc = await this.storyArcsRepo.save(
            this.storyArcsRepo.create({ universeId: story.universeId, title: generated.title, summary: null }),
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

      const { pages: pagesWithImages, totalCostUsd: totalImageCostUsd } = await this.generatePageImages(
        story,
        hero,
        heroName,
        heroAge,
        generated,
        supportingCharLabels,
        supportingCharAvatars,
        async (pageNum, total) => {
          await updateJob({
            currentStep: `Generating Illustrations (${pageNum}/${total})`,
            progressPercentage: 20 + Math.round((60 * pageNum) / total),
          });
        },
      );

      await updateJob({
        status: JobStatus.GeneratingAudio,
        currentStep: 'Generating Narration',
        progressPercentage: 82,
      });
      await this.storiesRepo.update(storyId, { status: StoryStatus.GeneratingAudio });

      const { pages, totalCostUsd: totalAudioCostUsd } = await this.generatePageAudio(story, pagesWithImages);

      const destination = story.universeId ? 'Saving Story to Universe' : 'Saving Story as Standalone Adventure';
      await updateJob({ status: JobStatus.SavingMemory, currentStep: destination, progressPercentage: 95 });

      await this.storiesRepo.update(storyId, {
        status: StoryStatus.Completed,
        title: generated.title || `${heroName}'s Adventure`,
        pages,
        coverImageUrl: pages[0]?.imageUrl ?? null,
        cliffhanger: generated.cliffhanger ?? null,
        arcId,
      });

      await this.persistUniverseExtracts(story, generated);
      await this.storyGenerationCostsRepo.save(
        this.storyGenerationCostsRepo.create({
          storyId,
          userId: story.userId,
          storyCostUsd,
          imageCostUsd: totalImageCostUsd,
          audioCostUsd: totalAudioCostUsd,
          totalCostUsd: storyCostUsd + totalImageCostUsd + totalAudioCostUsd,
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
    onPageDone?: (pageNum: number, total: number) => Promise<void>,
  ): Promise<{ pages: StoryPage[]; totalCostUsd: number }> {
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    const mode = this.config.get<string>('IMAGE_GENERATION_MODE') ?? 'full_generation';
    const pages: StoryPage[] = [];
    const total = generated.pages.length;
    let totalCostUsd = 0;

    let maxImages: number;
    if (mode === 'story_only') {
      maxImages = 0;
    } else if (mode === 'story_plus_cover') {
      maxImages = 1;
    } else if (mode === 'story_cover_first_two_pages') {
      maxImages = 3;
    } else {
      const capKey: keyof typeof SETTING_DEFAULTS = isDev ? 'MAX_IMAGES_PER_STORY_DEV' : 'MAX_IMAGES_PER_STORY_PROD';
      maxImages = await this.getNumberSetting(capKey, Number(SETTING_DEFAULTS[capKey].value));
    }

    const imageModel = this.config.get<string>('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
    const costPerImage = await this.getNumberSetting('OPENAI_IMAGE_COST_PER_IMAGE', Number(SETTING_DEFAULTS['OPENAI_IMAGE_COST_PER_IMAGE'].value));

    // Separate pages that get illustrations from those that don't (beyond maxImages cap)
    const illustratedPages = generated.pages.slice(0, maxImages);
    const remainingPages   = generated.pages.slice(maxImages);

    // Track settled count for live progress updates
    let settled = 0;

    type PageResult = { page: (typeof illustratedPages)[0]; imageOutput: import('../ai/interfaces/image-generation.provider').ImageGenerationOutput | null; error?: string };

    // Generate all illustrations in parallel — reduces wall time from N×T to ~T
    const generationResults: PageResult[] = await Promise.all(
      illustratedPages.map(async (page): Promise<PageResult> => {
        try {
          const imageOutput = await this.imageProvider.generateImage({
            sceneDescription: page.sceneDescription,
            heroName,
            heroAge,
            supportingCharacters,
            heroAvatarUrl: hero.avatarUrl ?? undefined,
            style: 'vibrant full-color children\'s storybook illustration, warm Pixar-style cartoon art, expressive characters, rich colorful backgrounds',
          });
          settled++;
          if (onPageDone) await onPageDone(settled, illustratedPages.length).catch(() => {});
          return { page, imageOutput };
        } catch (err) {
          settled++;
          if (onPageDone) await onPageDone(settled, illustratedPages.length).catch(() => {});
          return { page, imageOutput: null, error: err instanceof Error ? err.message : 'Unknown' };
        }
      }),
    );

    // Upload results sequentially (upload is fast; generation was the bottleneck)
    for (const { page, imageOutput, error } of generationResults) {
      if (!imageOutput) {
        this.logger.warn(`Image gen failed for story ${story.id}, page ${page.pageNumber}: ${error ?? 'Unknown'}`);
        pages.push({ pageNumber: page.pageNumber, text: page.text, imageUrl: undefined, audioUrl: undefined });
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
          }),
        );
      } catch (uploadErr) {
        this.logger.warn(
          `Image upload failed for story ${story.id}, page ${page.pageNumber}: ${
            uploadErr instanceof Error ? uploadErr.message : 'Unknown'
          }`,
        );
      }
      pages.push({ pageNumber: page.pageNumber, text: page.text, imageUrl, audioUrl: undefined });
    }

    // Pages beyond maxImages get no illustration
    for (const page of remainingPages) {
      pages.push({ pageNumber: page.pageNumber, text: page.text, imageUrl: undefined, audioUrl: undefined });
    }

    return { pages, totalCostUsd };
  }

  private async generatePageAudio(story: Story, pages: StoryPage[]): Promise<{ pages: StoryPage[]; totalCostUsd: number }> {
    const result: StoryPage[] = [];
    let totalCostUsd = 0;
    const ttsCostPerChar = await this.getNumberSetting('OPENAI_TTS_COST_PER_CHAR', Number(SETTING_DEFAULTS['OPENAI_TTS_COST_PER_CHAR'].value));

    for (const page of pages) {
      let audioUrl: string | undefined;
      try {
        const narration = await this.narrationProvider.generateNarration({
          text: page.text,
          language: 'en-IN',
          accent: 'Indian English',
          tone: 'warm storyteller',
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

        const estimatedSeconds = Math.max(5, Math.ceil(page.text.split(/\s+/).filter(Boolean).length * 0.55));
        const pageCostUsd = page.text.length * ttsCostPerChar;
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
          }),
        );
      } catch (err) {
        this.logger.warn(
          `Audio gen failed for story ${story.id}, page ${page.pageNumber}: ${
            err instanceof Error ? err.message : 'Unknown'
          }`,
        );
      }
      result.push({ ...page, audioUrl });
    }
    return { pages: result, totalCostUsd };
  }

  private async logStoryGeneration(
    storyId: string,
    userId: string,
    universeId: string | null,
    generated: StoryGenerationOutput,
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
      }),
    );

    if (generated.prompt && generated.rawResponse) {
      await this.storyGenerationLogsRepo.save(
        this.storyGenerationLogsRepo.create({
          storyId,
          provider,
          model,
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
    };
  }

  private async buildSupportingCharacterContext(story: Story): Promise<Array<{ label: string; avatarUrl: string | null }>> {
    const characterIds = story.characterIds ?? [];
    if (characterIds.length === 0) return [];

    const characters = await this.charactersRepo.find({ where: { id: In(characterIds), userId: story.userId } });
    return characters.map((c) => ({ label: `${c.name} (${c.role})`, avatarUrl: c.avatarUrl ?? null }));
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

  private async persistUniverseExtracts(story: Story, generated: StoryGenerationOutput): Promise<void> {
    if (!story.universeId) return;

    const validMemoryTypes = new Set<string>(Object.values(MemoryType));
    const memories = (generated.newMemories ?? [])
      .filter((m) => validMemoryTypes.has(m.type))
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

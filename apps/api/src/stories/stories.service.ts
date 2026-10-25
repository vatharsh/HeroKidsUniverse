import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { Character } from '../characters/entities/character.entity';
import { CompanionsService } from '../companions/companions.service';
import { CompanionType } from '../companions/entities/universe-companion.entity';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { AiSpendGuardService } from '../generation/ai-spend-guard.service';
import { GenerationService } from '../generation/generation.service';
import { Hero } from '../heroes/hero.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Quest } from '../quests/quest.entity';
import { UniverseMemory } from '../universes/universe-memory.entity';
import { Universe } from '../universes/universe.entity';
import { UploadService } from '../upload/upload.service';
import { User, UserRole } from '../users/user.entity';
import { CreateStoryDto } from './dto/create-story.dto';
import { storyAssetUrls } from './story-assets';
import { Story, StoryMode, StoryStatus } from './story.entity';
import { ContentSafetyService } from '../ai/content-safety.service';
import { isSandboxFor } from '../common/sandbox';
import { PreviewQuotaService } from './preview-quota.service';

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story)
    private readonly storiesRepository: Repository<Story>,
    @InjectRepository(Hero)
    private readonly heroesRepository: Repository<Hero>,
    @InjectRepository(Character)
    private readonly charactersRepository: Repository<Character>,
    @InjectRepository(Universe)
    private readonly universesRepository: Repository<Universe>,
    @InjectRepository(UniverseMemory)
    private readonly memoriesRepository: Repository<UniverseMemory>,
    @InjectRepository(HeroPower)
    private readonly powersRepository: Repository<HeroPower>,
    @InjectRepository(Quest)
    private readonly questsRepository: Repository<Quest>,
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
    private readonly dataSource: DataSource,
    private readonly generationService: GenerationService,
    private readonly companionsService: CompanionsService,
    private readonly uploadService: UploadService,
    private readonly safety: ContentSafetyService,
    private readonly previewQuota: PreviewQuotaService,
    private readonly spendGuard: AiSpendGuardService,
  ) {}

  /**
   * Test accounts (pre-launch) may create only TEST_ACCOUNT_STORY_LIMIT stories, to keep AI spend down.
   * Counted from the credit history, so deleting a story doesn't free a slot; failed (refunded) stories
   * don't count. Runs under the user-row lock, so parallel requests can't slip past it.
   */
  private async assertTestAccountAllowance(manager: EntityManager, user: User): Promise<void> {
    if (!user.isTestAccount || user.role === UserRole.Admin) return;
    const row = await manager.findOne(PlatformSetting, { where: { key: 'TEST_ACCOUNT_STORY_LIMIT' } });
    const limit = Number(row?.value ?? SETTING_DEFAULTS.TEST_ACCOUNT_STORY_LIMIT.value);
    if (!Number.isFinite(limit)) return;
    const [{ used }] = await manager.query(
      `SELECT COUNT(*)::int AS used FROM credit_transactions g
        WHERE g."userId" = $1 AND g.reason = $2
          AND NOT EXISTS (SELECT 1 FROM credit_transactions r
                           WHERE r."userId" = $1 AND r.reason = $3 AND r."referenceId" = g."referenceId")`,
      [user.id, CreditTransactionReason.StoryGeneration, CreditTransactionReason.Refund],
    );
    if (used >= limit) {
      throw new HttpException(
        `This is a test account — test accounts can create only ${limit} ${limit === 1 ? 'story' : 'stories'}, and this one has already made ${used}.`,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async create(userId: string, createStoryDto: CreateStoryDto): Promise<Story> {
    await this.safety.assertSafeInput({ storyContext: createStoryDto.storyContext, companionName: createStoryDto.companionName }, userId);
    const hero = await this.heroesRepository.findOne({
      where: { id: createStoryDto.heroId, userId },
    });

    if (!hero) {
      throw new NotFoundException('Hero not found');
    }

    const isStandalone = createStoryDto.storyMode === StoryMode.Standalone;

    // Standalone stories are always independent — ignore any universe on the hero or request
    let universeId = isStandalone ? null : (createStoryDto.universeId ?? hero.universeId ?? null);

    if (universeId) {
      const universe = await this.universesRepository.findOne({ where: { id: universeId } });

      if (!universe) {
        throw new NotFoundException('Universe not found');
      }

      if (universe.userId !== userId) {
        throw new ForbiddenException('You do not own this universe');
      }
    }

    // Auto-link to the user's universe if not already specified (never for standalone)
    if (!universeId && !isStandalone) {
      const defaultUniverse = await this.universesRepository.findOne({ where: { userId } });
      if (defaultUniverse) {
        universeId = defaultUniverse.id;
        // Also update the hero so future stories auto-link without the lookup
        if (!hero.universeId) {
          await this.heroesRepository.update(hero.id, { universeId });
        }
      }
    }

    const existingCompanion = universeId
      ? await this.companionsService.getByUniverse(universeId)
      : null;

    if (createStoryDto.companionType && !existingCompanion && universeId) {
      if (!Object.values(CompanionType).includes(createStoryDto.companionType as CompanionType)) {
        throw new BadRequestException('Invalid companion type');
      }

      await this.companionsService.createOrReplace(userId, universeId, {
        type: createStoryDto.companionType as CompanionType,
        name: createStoryDto.companionName || createStoryDto.companionType,
        petCharacterId: createStoryDto.companionPetId,
      });
    }

    const characterIds = createStoryDto.characterIds ?? [];
    if (characterIds.length > 0) {
      const characters = await this.charactersRepository.find({
        where: { id: In(characterIds), userId },
      });

      if (characters.length !== characterIds.length) {
        throw new NotFoundException('One or more characters not found');
      }
    }

    const isSandbox = await isSandboxFor(this.dataSource, userId);
    if (!isSandbox) await this.spendGuard.assertCanStartStory();

    const story = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneOrFail(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      await this.assertTestAccountAllowance(manager, user);

      // Paid credits are always used first; the free preview (a shorter story) only when none are left.
      const isPreview = user.credits < 1 && user.previewCredits > 0;
      if (user.credits < 1 && !isPreview) {
        throw new HttpException('Not enough credits', HttpStatus.PAYMENT_REQUIRED);
      }
      if (isPreview) {
        await this.previewQuota.assertPreviewAvailable(manager, user);
        await this.previewQuota.clearWaitlist(manager, user.id);
      }

      if (isPreview) user.previewCredits -= 1;
      else user.credits -= 1;
      await manager.save(user);

      const story = await manager.save(
        manager.create(Story, {
          userId,
          heroId: hero.id,
          universeId,
          theme: createStoryDto.theme ?? null,
          storyMode: createStoryDto.storyMode ?? StoryMode.NewAdventure,
          storyContext: createStoryDto.storyContext ?? null,
          cliffhanger: null,
          arcId: null,
          status: StoryStatus.Pending,
          pages: [],
          characterIds,
          skipCompanion: createStoryDto.skipCompanion ?? null,
          creditsUsed: isPreview ? 0 : 1,
          isSandbox,
          isPreview,
        }),
      );

      await manager.save(
        manager.create(CreditTransaction, {
          userId,
          delta: isPreview ? 0 : -1,
          reason: CreditTransactionReason.StoryGeneration,
          referenceId: story.id,
        }),
      );

      return story;
    });

    // Fire-and-forget — respond immediately, generation runs in background
    void this.generationService.generateStory(story.id, userId);

    return story;
  }

  findAll(userId: string, universeId?: string, standalone?: boolean): Promise<Story[]> {
    if (standalone) {
      return this.storiesRepository.find({
        where: { userId, universeId: IsNull() },
        relations: { hero: true },
        order: { createdAt: 'DESC' },
      });
    }
    if (universeId) {
      return this.storiesRepository.find({
        where: { userId, universeId },
        relations: { hero: true },
        order: { createdAt: 'DESC' },
      });
    }
    return this.storiesRepository.find({
      where: { userId },
      relations: { hero: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Story> {
    const story = await this.storiesRepository.findOne({
      where: { id, userId },
      relations: { hero: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    return story;
  }

  async findOnePublic(id: string): Promise<Story> {
    const story = await this.storiesRepository.findOne({
      where: { id, status: StoryStatus.Completed },
      relations: { hero: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    return story;
  }

  async getRecap(
    userId: string,
    storyId: string,
  ): Promise<{
    cliffhanger: string | null;
    memoriesEarned: UniverseMemory[];
    powersEarned: HeroPower[];
    questsOpened: Quest[];
  }> {
    const story = await this.findOne(userId, storyId);

    const [memoriesEarned, powersEarned, questsOpened] = await Promise.all([
      this.memoriesRepository.find({ where: { storyId } }),
      this.powersRepository.find({ where: { earnedInStoryId: storyId } }),
      this.questsRepository.find({ where: { openedInStoryId: storyId } }),
    ]);

    return {
      cliffhanger: story.cliffhanger,
      memoriesEarned,
      powersEarned,
      questsOpened,
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const story = await this.findOne(userId, id);
    await this.generationService.deleteJobsByStoryId(story.id);

    // Collect all R2 object URLs before removing the DB row
    const assetUrls = storyAssetUrls(story);

    await this.storiesRepository.remove(story);

    // Delete R2 objects after DB removal — fire-and-forget errors (don't fail the delete)
    await Promise.allSettled(assetUrls.map((url) => this.uploadService.deleteObject(url)));
  }
}

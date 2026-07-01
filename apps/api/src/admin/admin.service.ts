import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  ILike,
  In,
  IsNull,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { AiOperation, AiUsageLog } from '../ai/entities/ai-usage-log.entity';
import { StoryGenerationCost } from '../ai/entities/story-generation-cost.entity';
import { Character } from '../characters/entities/character.entity';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { GenerationJob, JobStatus } from '../generation/generation-job.entity';
import { Hero } from '../heroes/hero.entity';
import { InfluencerReferral } from '../influencers/influencer-referral.entity';
import { CouponDiscountType, InfluencerCouponCode, CouponType } from '../influencers/influencer-coupon-code.entity';
import { Influencer } from '../influencers/influencer.entity';
import { InfluencersService } from '../influencers/influencers.service';
import { MerchandiseOrder, OrderStatus, ProductType } from '../merchandise/order.entity';
import { OrderStatusHistory } from '../merchandise/order-status-history.entity';
import { CommerceOrderStatus, CommerceOrderType, Order as CommerceOrder } from '../merchandise/orders/order.entity';
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { StoryArc } from '../story-arcs/story-arc.entity';
import { Story, StoryStatus, StoryTheme, VideoStatus } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { User, UserPlan, UserRole } from '../users/user.entity';
import { PlatformSetting, PUBLIC_SETTING_KEYS, SETTING_DEFAULTS, normalizeSettingValue } from './platform-setting.entity';

const ACTIVE_JOB_STATUSES = [
  JobStatus.Queued,
  JobStatus.GeneratingStory,
  JobStatus.GeneratingCover,
  JobStatus.GeneratingImages,
  JobStatus.GeneratingAudio,
  JobStatus.SavingMemory,
] as string[];

type PageResponse<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  return Number(value);
}

function makePage<T>(items: T[], total: number, page: number, limit: number): PageResponse<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Story) private readonly storiesRepo: Repository<Story>,
    @InjectRepository(Universe) private readonly universesRepo: Repository<Universe>,
    @InjectRepository(GenerationJob) private readonly jobsRepo: Repository<GenerationJob>,
    @InjectRepository(AiUsageLog) private readonly aiUsageRepo: Repository<AiUsageLog>,
    @InjectRepository(StoryGenerationCost) private readonly costRepo: Repository<StoryGenerationCost>,
    @InjectRepository(CreditTransaction) private readonly creditRepo: Repository<CreditTransaction>,
    @InjectRepository(MerchandiseOrder) private readonly ordersRepo: Repository<MerchandiseOrder>,
    @InjectRepository(OrderStatusHistory) private readonly historyRepo: Repository<OrderStatusHistory>,
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
    @InjectRepository(Influencer) private readonly influencersRepo: Repository<Influencer>,
    @InjectRepository(InfluencerReferral) private readonly referralsRepo: Repository<InfluencerReferral>,
    @InjectRepository(PlatformSetting) private readonly settingsRepo: Repository<PlatformSetting>,
    @InjectRepository(CommerceOrder) private readonly commerceOrdersRepo: Repository<CommerceOrder>,
    private readonly dataSource: DataSource,
    private readonly influencersService: InfluencersService,
  ) {}

  async onModuleInit() {
    try {
      const setting = await this.settingsRepo.findOne({ where: { key: 'SANDBOX_MODE' } });
      const isSandbox = setting ? setting.value === 'true' : true;
      if (isSandbox) {
        const [usersResult, universesResult, storiesResult] = await Promise.all([
          this.usersRepo.createQueryBuilder().update().set({ isSandbox: true }).where('isSandbox = false').execute(),
          this.universesRepo.createQueryBuilder().update().set({ isSandbox: true }).where('isSandbox = false').execute(),
          this.storiesRepo.createQueryBuilder().update().set({ isSandbox: true }).where('isSandbox = false').execute(),
        ]);
        const total = (usersResult.affected ?? 0) + (universesResult.affected ?? 0) + (storiesResult.affected ?? 0);
        if (total > 0) {
          this.logger.log(`Backfilled ${usersResult.affected} users, ${universesResult.affected} universes, ${storiesResult.affected} stories to isSandbox=true`);
        }
      }
    } catch (err) {
      this.logger.warn('Admin isSandbox backfill skipped', err);
    }
  }

  // ── Platform Settings ──────────────────────────────────────────────────────

  async getSettings() {
    await this.ensureDefaultSettings();
    const rows = await this.settingsRepo.find({ order: { key: 'ASC' } });
    const existing = new Map(rows.map((r) => [r.key, r]));

    return Object.entries(SETTING_DEFAULTS).map(([key, def]) => {
      const row = existing.get(key);
      return {
        key,
        value: row?.value ?? def.value,
        type: row?.type ?? def.type,
        description: row?.description ?? def.description,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async getPublicSettings() {
    const rows = await this.settingsRepo.find({
      where: PUBLIC_SETTING_KEYS.map((key) => ({ key })),
    });
    const stored = new Map(rows.map((r) => [r.key, r.value]));

    return PUBLIC_SETTING_KEYS.map((key) => {
      const def = SETTING_DEFAULTS[key];
      return {
        key,
        value: stored.get(key) ?? def?.value ?? 'false',
        type: def?.type ?? 'boolean',
      };
    });
  }

  async upsertSetting(key: string, value: unknown) {
    const def = SETTING_DEFAULTS[key];
    const type = def?.type ?? (await this.settingsRepo.findOne({ where: { key } }))?.type ?? 'string';
    const description = def?.description ?? null;
    this.validateSettingValue(key, type, value);
    await this.settingsRepo.upsert({ key, value: normalizeSettingValue(type, value), type, description }, ['key']);
    const row = await this.settingsRepo.findOne({ where: { key } });
    return row ?? { key, value: normalizeSettingValue(type, value), type, description, updatedAt: new Date() };
  }

  private validateSettingValue(key: string, type: string, value: unknown) {
    if (type === 'number') {
      const raw = typeof value === 'number' ? value : Number(String(value ?? '').trim());
      if (!Number.isFinite(raw)) {
        throw new BadRequestException(`${key} must be a valid number`);
      }
    }

    if (type === 'boolean' && typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(normalized)) {
        throw new BadRequestException(`${key} must be a valid boolean`);
      }
    }
  }

  // ── Health Score ───────────────────────────────────────────────────────────

  async getHealth() {
    const [todayStart] = this.getDateBounds();
    const [usdToInr, dailyWarning, monthlyWarning, dailyHardLimit, monthlyHardLimit] = await Promise.all([
      this.getSetting('USD_INR_RATE', 96),
      this.getSetting('AI_DAILY_COST_WARNING_USD', 10),
      this.getSetting('AI_MONTHLY_COST_WARNING_USD', 200),
      this.getSetting('AI_DAILY_COST_HARD_LIMIT_USD', 25),
      this.getSetting('AI_MONTHLY_COST_HARD_LIMIT_USD', 500),
    ]);

    const [monthStart] = this.getDateBounds();
    const [revenueToday, aiCostToday, aiCostThisMonth, storiesGeneratedToday, activeJobs] = await Promise.all([
      this.sumOrderRevenue(todayStart),
      this.sumAiCost(todayStart),
      this.sumAiCost(monthStart),
      this.storiesRepo.count({ where: { createdAt: MoreThanOrEqual(todayStart) } as any }),
      this.jobsRepo.count({ where: { status: In(ACTIVE_JOB_STATUSES) } as any }),
    ]);

    let healthStatus: 'Good' | 'Warning' | 'Critical' = 'Good';
    if (aiCostToday >= dailyWarning || aiCostThisMonth >= monthlyWarning) healthStatus = 'Warning';
    if (aiCostToday >= dailyHardLimit || aiCostThisMonth >= monthlyHardLimit) healthStatus = 'Critical';

    return {
      revenueToday,
      aiCostToday,
      aiCostTodayInr: aiCostToday * usdToInr,
      storiesGeneratedToday,
      activeJobs,
      healthStatus,
      usdToInr,
    };
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboard(sandboxFilter?: boolean) {
    const [todayStart, monthStart] = this.getDateBounds();
    const [usdToInr, dailyWarning, monthlyWarning, dailyHardLimit, monthlyHardLimit, displayCurrency, sandboxMode] = await Promise.all([
      this.getSetting('USD_INR_RATE', 96),
      this.getSetting('AI_DAILY_COST_WARNING_USD', 10),
      this.getSetting('AI_MONTHLY_COST_WARNING_USD', 200),
      this.getSetting('AI_DAILY_COST_HARD_LIMIT_USD', 25),
      this.getSetting('AI_MONTHLY_COST_HARD_LIMIT_USD', 500),
      this.getSettingString('DISPLAY_CURRENCY', 'INR'),
      this.getSettingBool('SANDBOX_MODE', true),
    ]);

    // All counts and costs filtered consistently by the same sandbox flag
    const sf = sandboxFilter;  // undefined = all, true = sandbox, false = live

    const userWhere = sf !== undefined ? { isSandbox: sf } : {};
    const universeWhere = sf !== undefined ? { isSandbox: sf } : {};
    const storyWhere = sf !== undefined ? { isSandbox: sf } : {};
    const orderWhere = sf !== undefined
      ? { status: CommerceOrderStatus.Processing, isDeleted: false, isSandbox: sf }
      : { status: CommerceOrderStatus.Processing, isDeleted: false };
    const shippedWhere = sf !== undefined
      ? { status: CommerceOrderStatus.Shipped, isDeleted: false, isSandbox: sf, updatedAt: MoreThanOrEqual(todayStart) }
      : { status: CommerceOrderStatus.Shipped, isDeleted: false, updatedAt: MoreThanOrEqual(todayStart) };

    const [
      totalUsers,
      totalUniverses,
      totalStories,
      storiesToday,
      activeGenerations,
      pendingMerchandiseOrders,
      ordersShippedToday,
      totalRevenueInr,
      revenueToday,
      revenueThisMonth,
      totalAiCostUsd,
      aiCostToday,
      aiCostThisMonth,
      mostPopularThemeRow,
      mostPopularProductRow,
    ] = await Promise.all([
      this.usersRepo.count({ where: userWhere as any }),
      this.universesRepo.count({ where: universeWhere as any }),
      this.storiesRepo.count({ where: storyWhere as any }),
      this.storiesRepo.count({ where: { ...storyWhere, createdAt: MoreThanOrEqual(todayStart) } as any }),
      this.jobsRepo.count({ where: { status: In(ACTIVE_JOB_STATUSES) } as any }),
      this.commerceOrdersRepo.count({ where: orderWhere as any }),
      this.commerceOrdersRepo.count({ where: shippedWhere as any }),
      this.sumOrderRevenue(undefined, sf),
      this.sumOrderRevenue(todayStart, sf),
      this.sumOrderRevenue(monthStart, sf),
      this.sumAiCost(undefined, sf),
      this.sumAiCost(todayStart, sf),
      this.sumAiCost(monthStart, sf),
      (() => {
        const qb = this.storiesRepo
          .createQueryBuilder('story')
          .select('story.theme', 'theme')
          .addSelect('COUNT(*)', 'count')
          .where('story.theme IS NOT NULL');
        if (sf !== undefined) qb.andWhere('story.isSandbox = :sf', { sf });
        return qb.groupBy('story.theme').orderBy('COUNT(*)', 'DESC').limit(1).getRawOne<{ theme: StoryTheme; count: string }>();
      })(),
      (() => {
        const qb = this.commerceOrdersRepo
          .createQueryBuilder('co')
          .select('co.orderType', 'productType')
          .addSelect('COUNT(*)', 'count')
          .where('co.isDeleted = false');
        if (sf !== undefined) qb.andWhere('co.isSandbox = :sf', { sf });
        return qb.groupBy('co.orderType').orderBy('COUNT(*)', 'DESC').limit(1).getRawOne<{ productType: string; count: string }>();
      })(),
    ]);

    const estimatedGrossProfitInr = revenueThisMonth - totalAiCostUsd * usdToInr;
    const profitMarginPct = revenueThisMonth > 0 ? (estimatedGrossProfitInr / revenueThisMonth) * 100 : 0;
    const aiCostWarning = aiCostToday >= dailyWarning || aiCostThisMonth >= monthlyWarning;
    const aiCostCritical = aiCostToday >= dailyHardLimit || aiCostThisMonth >= monthlyHardLimit;

    return {
      totalUsers,
      totalUniverses,
      totalStories,
      storiesToday,
      activeGenerations,
      pendingMerchandiseOrders,
      ordersShippedToday,
      totalRevenueInr,
      revenueToday,
      revenueThisMonth,
      totalAiCostUsd,
      aiCostToday,
      aiCostThisMonth,
      estimatedGrossProfitInr,
      profitMarginPct,
      mostPopularTheme: mostPopularThemeRow?.theme ?? '',
      mostPopularProduct: mostPopularProductRow?.productType ?? '',
      aiCostWarning,
      aiCostCritical,
      usdToInr,
      displayCurrency,
      sandboxMode,
      revenueView: sandboxFilter !== undefined ? (sandboxFilter ? 'sandbox' : 'live') : 'all',
    };
  }

  async listUsers(page = 1, limit = 20, search?: string) {
    const qb = this.usersRepo.createQueryBuilder('user');
    if (search?.trim()) {
      qb.andWhere('(user.email ILIKE :q OR user.name ILIKE :q)', { q: `%${search.trim()}%` });
    }

    const [items, total] = await qb.orderBy('user.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const ids = items.map((u) => u.id);

    const [storyRows, universeRows, aiRows] = await Promise.all([
      ids.length
        ? this.storiesRepo
            .createQueryBuilder('story')
            .select('story.userId', 'userId')
            .addSelect('COUNT(*)', 'count')
            .where('story.userId IN (:...ids)', { ids })
            .groupBy('story.userId')
            .getRawMany<{ userId: string; count: string }>()
        : Promise.resolve([] as Array<{ userId: string; count: string }>),
      ids.length
        ? this.universesRepo
            .createQueryBuilder('universe')
            .select('universe.userId', 'userId')
            .addSelect('COUNT(*)', 'count')
            .where('universe.userId IN (:...ids)', { ids })
            .groupBy('universe.userId')
            .getRawMany<{ userId: string; count: string }>()
        : Promise.resolve([] as Array<{ userId: string; count: string }>),
      ids.length
        ? this.aiUsageRepo
            .createQueryBuilder('ai')
            .select('ai.userId', 'userId')
            .addSelect('SUM(ai.estimatedCostUsd)', 'cost')
            .where('ai.userId IN (:...ids)', { ids })
            .groupBy('ai.userId')
            .getRawMany<{ userId: string; cost: string }>()
        : Promise.resolve([] as Array<{ userId: string; cost: string }>),
    ]);

    const storyMap = new Map(storyRows.map((r) => [r.userId, Number(r.count)]));
    const universeMap = new Map(universeRows.map((r) => [r.userId, Number(r.count)]));
    const aiMap = new Map(aiRows.map((r) => [r.userId, toNumber(r.cost)]));

    return makePage(
      items.map((user) => ({
        ...user,
        storyCount: storyMap.get(user.id) ?? 0,
        universeCount: universeMap.get(user.id) ?? 0,
        totalAiCostUsd: aiMap.get(user.id) ?? 0,
      })),
      total,
      page,
      limit,
    );
  }

  async getUserDetail(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [storyCount, universeCount, transactions, aiCostRow] = await Promise.all([
      this.storiesRepo.count({ where: { userId } }),
      this.universesRepo.count({ where: { userId } }),
      this.creditRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 }),
      this.aiUsageRepo
        .createQueryBuilder('ai')
        .select('SUM(ai.estimatedCostUsd)', 'cost')
        .where('ai.userId = :userId', { userId })
        .getRawOne<{ cost: string }>(),
    ]);

    return {
      ...user,
      storyCount,
      universeCount,
      totalAiCostUsd: toNumber(aiCostRow?.cost),
      creditHistory: transactions,
    };
  }

  async updateUser(userId: string, body: Partial<Pick<User, 'role' | 'plan' | 'credits' | 'isPremium'>>) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    Object.assign(user, body);
    return this.usersRepo.save(user);
  }

  async listUniverses(page = 1, limit = 20, search?: string) {
    const qb = this.universesRepo.createQueryBuilder('universe').leftJoinAndSelect('universe.user', 'user');
    if (search?.trim()) {
      qb.andWhere('(universe.name ILIKE :q OR user.email ILIKE :q)', { q: `%${search.trim()}%` });
    }
    const [items, total] = await qb.orderBy('universe.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const ids = items.map((u) => u.id);

    const [storyRows, imageRows, costRows] = await Promise.all([
      ids.length
        ? this.storiesRepo
            .createQueryBuilder('story')
            .select('story.universeId', 'universeId')
            .addSelect('COUNT(*)', 'count')
            .where('story.universeId IN (:...ids)', { ids })
            .groupBy('story.universeId')
            .getRawMany<{ universeId: string; count: string }>()
        : Promise.resolve([] as Array<{ universeId: string; count: string }>),
      ids.length
        ? this.aiUsageRepo
            .createQueryBuilder('ai')
            .select('ai.universeId', 'universeId')
            .addSelect('COUNT(*)', 'count')
            .where('ai.universeId IN (:...ids) AND ai.operation = :op', {
              ids,
              op: AiOperation.ImageGeneration,
            })
            .groupBy('ai.universeId')
            .getRawMany<{ universeId: string; count: string }>()
        : Promise.resolve([] as Array<{ universeId: string; count: string }>),
      ids.length
        ? this.aiUsageRepo
            .createQueryBuilder('ai')
            .select('ai.universeId', 'universeId')
            .addSelect('SUM(ai.estimatedCostUsd)', 'cost')
            .where('ai.universeId IN (:...ids)', { ids })
            .groupBy('ai.universeId')
            .getRawMany<{ universeId: string; cost: string }>()
        : Promise.resolve([] as Array<{ universeId: string; cost: string }>),
    ]);

    const storyMap = new Map(storyRows.map((r) => [r.universeId, Number(r.count)]));
    const imageMap = new Map(imageRows.map((r) => [r.universeId, Number(r.count)]));
    const costMap = new Map(costRows.map((r) => [r.universeId, toNumber(r.cost)]));

    return makePage(
      items.map((universe) => ({
        ...universe,
        storyCount: storyMap.get(universe.id) ?? 0,
        imageCount: imageMap.get(universe.id) ?? 0,
        aiCostUsd: costMap.get(universe.id) ?? 0,
      })),
      total,
      page,
      limit,
    );
  }

  async listStories(
    page = 1,
    limit = 20,
    filters: { userId?: string; universeId?: string; status?: string; theme?: string } = {},
  ) {
    const qb = this.storiesRepo
      .createQueryBuilder('story')
      .leftJoinAndSelect('story.user', 'user')
      .leftJoinAndSelect('story.hero', 'hero');

    if (filters.userId) qb.andWhere('story.userId = :userId', { userId: filters.userId });
    if (filters.universeId) qb.andWhere('story.universeId = :universeId', { universeId: filters.universeId });
    if (filters.status) qb.andWhere('story.status = :status', { status: filters.status });
    if (filters.theme) qb.andWhere('story.theme = :theme', { theme: filters.theme });

    const [items, total] = await qb.orderBy('story.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const ids = items.map((story) => story.id);
    const costRows = ids.length
      ? await this.costRepo
          .createQueryBuilder('cost')
          .where('cost.storyId IN (:...ids)', { ids })
          .getMany()
      : [];
    const costMap = new Map(costRows.map((row) => [row.storyId, toNumber(row.totalCostUsd)]));

    return makePage(
      items.map((story) => ({
        ...story,
        userEmail: story.user?.email ?? '',
        heroName: story.hero?.name ?? '',
        totalCostUsd: costMap.get(story.id) ?? 0,
      })),
      total,
      page,
      limit,
    );
  }

  async getStoryDetail(storyId: string) {
    const story = await this.storiesRepo.findOne({
      where: { id: storyId },
      relations: { user: true, hero: true },
    });
    if (!story) throw new NotFoundException('Story not found');

    const cost = await this.costRepo.findOne({ where: { storyId } });
    return {
      ...story,
      userEmail: story.user.email,
      heroName: story.hero.name,
      cost: cost ?? null,
    };
  }

  async deleteStory(storyId: string) {
    const story = await this.storiesRepo.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');
    await this.storiesRepo.remove(story);
    return { success: true };
  }

  async listJobs(page = 1, limit = 20, status?: string, search?: string) {
    const qb = this.jobsRepo
      .createQueryBuilder('job')
      .leftJoin('users', 'user', 'user.id = job.userId')
      .leftJoin('stories', 'story', 'story.id = job.storyId')
      .leftJoin('universes', 'universe', 'universe.id = job.universeId');
    if (status) qb.andWhere('job.status = :status', { status });
    if (search?.trim()) {
      qb.andWhere('(job.id ILIKE :q OR user.email ILIKE :q OR story.title ILIKE :q OR universe.name ILIKE :q)', {
        q: `%${search.trim()}%`,
      });
    }
    const [items, total] = await qb.orderBy('job.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const userIds = items.map((job) => job.userId);
    const storyIds = items.map((job) => job.storyId);
    const universeIds = items.map((job) => job.universeId).filter((id): id is string => !!id);
    const [users, stories, universes] = await Promise.all([
      userIds.length ? this.usersRepo.find({ where: { id: In(userIds) } }) : Promise.resolve([] as User[]),
      storyIds.length ? this.storiesRepo.find({ where: { id: In(storyIds) } }) : Promise.resolve([] as Story[]),
      universeIds.length ? this.universesRepo.find({ where: { id: In(universeIds) } }) : Promise.resolve([] as Universe[]),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u.email]));
    const storyMap = new Map(stories.map((s) => [s.id, s.title ?? '']));
    const universeMap = new Map(universes.map((u) => [u.id, u.name]));

    return makePage(
      items.map((job) => ({
        ...job,
        userEmail: userMap.get(job.userId) ?? '',
        universeName: job.universeId ? universeMap.get(job.universeId) ?? '' : '',
        storyTitle: storyMap.get(job.storyId) ?? '',
        durationMs: this.jobDurationMs(job),
      })),
      total,
      page,
      limit,
    );
  }

  async retryJob(jobId: string) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    Object.assign(job, {
      status: JobStatus.Queued,
      currentStep: null,
      progressPercentage: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    });
    return this.jobsRepo.save(job);
  }

  async deleteJob(jobId: string) {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    await this.jobsRepo.remove(job);
    return { success: true };
  }

  async listOrders(page = 1, limit = 20, status?: string, search?: string) {
    const qb = this.ordersRepo.createQueryBuilder('merchOrder').leftJoin('users', 'user', 'user.id = merchOrder.userId');
    if (status) qb.andWhere('merchOrder.status = :status', { status });
    if (search?.trim()) {
      qb.andWhere('(merchOrder.id ILIKE :q OR user.email ILIKE :q)', { q: `%${search.trim()}%` });
    }
    const [items, total] = await qb.orderBy('merchOrder.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const userIds = items.map((order) => order.userId);
    const users = userIds.length ? await this.usersRepo.find({ where: { id: In(userIds) } }) : [];
    const userMap = new Map(users.map((u) => [u.id, u.email]));
    return makePage(
      items.map((order) => ({ ...order, userEmail: userMap.get(order.userId) ?? '' })),
      total,
      page,
      limit,
    );
  }

  async getOrderDetail(orderId: string) {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const history = await this.historyRepo.find({ where: { orderId }, order: { createdAt: 'DESC' } });
    const user = await this.usersRepo.findOne({ where: { id: order.userId } });
    return { ...order, userEmail: user?.email ?? '', history };
  }

  async updateOrder(
    orderId: string,
    adminUserId: string,
    body: Partial<Pick<MerchandiseOrder, 'status' | 'trackingNumber' | 'trackingUrl' | 'adminNotes' | 'printFileUrl'>> & { note?: string },
  ) {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const oldStatus = order.status;
    const nextStatus = body.status ?? order.status;
    Object.assign(order, {
      status: nextStatus,
      trackingNumber: body.trackingNumber ?? order.trackingNumber,
      trackingUrl: body.trackingUrl ?? order.trackingUrl,
      adminNotes: body.adminNotes ?? order.adminNotes,
      printFileUrl: body.printFileUrl ?? order.printFileUrl,
    });

    const saved = await this.ordersRepo.save(order);
    if (oldStatus !== nextStatus) {
      await this.historyRepo.save(
        this.historyRepo.create({
          orderId,
          oldStatus,
          newStatus: nextStatus,
          note: body.note ?? null,
          changedByUserId: adminUserId,
        }),
      );
    }
    return saved;
  }

  async listPayments(page = 1, limit = 20, status?: string, search?: string) {
    const qb = this.paymentsRepo.createQueryBuilder('payment').leftJoin('users', 'user', 'user.id = payment.userId');
    if (status) qb.andWhere('payment.status = :status', { status });
    if (search?.trim()) {
      qb.andWhere('(payment.razorpayOrderId ILIKE :q OR payment.razorpayPaymentId ILIKE :q OR user.email ILIKE :q)', {
        q: `%${search.trim()}%`,
      });
    }
    const [items, total] = await qb.orderBy('payment.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const users = items.length ? await this.usersRepo.find({ where: { id: In(items.map((p) => p.userId)) } }) : [];
    const userMap = new Map(users.map((u) => [u.id, u.email]));
    return makePage(
      items.map((payment) => ({ ...payment, userEmail: userMap.get(payment.userId) ?? '' })),
      total,
      page,
      limit,
    );
  }

  async getAiAnalytics(isSandbox?: boolean) {
    const [todayStart, monthStart] = this.getDateBounds();

    const addSandboxFilter = (qb: ReturnType<typeof this.aiUsageRepo.createQueryBuilder>) => {
      if (isSandbox !== undefined) qb.andWhere('ai.isSandbox = :isSandbox', { isSandbox });
      return qb;
    };
    const addCostSandboxFilter = (qb: ReturnType<typeof this.costRepo.createQueryBuilder>) => {
      if (isSandbox !== undefined) qb.andWhere('cost.isSandbox = :isSandbox', { isSandbox });
      return qb;
    };

    const [aiCostToday, aiCostThisMonth, totalImagesGenerated, totalNarrationSeconds, totalVideosGenerated] =
      await Promise.all([
        this.sumAiCost(todayStart, isSandbox),
        this.sumAiCost(monthStart, isSandbox),
        addSandboxFilter(this.aiUsageRepo
          .createQueryBuilder('ai')
          .select('COALESCE(SUM(ai.imagesGenerated), 0)', 'sum')
          .where('ai.operation = :op', { op: AiOperation.ImageGeneration }))
          .getRawOne<{ sum: string }>()
          .then((r) => toNumber(r?.sum)),
        addSandboxFilter(this.aiUsageRepo
          .createQueryBuilder('ai')
          .select('COALESCE(SUM(ai.audioSeconds), 0)', 'sum')
          .where('ai.operation = :op', { op: AiOperation.Narration }))
          .getRawOne<{ sum: string }>()
          .then((r) => toNumber(r?.sum)),
        this.storiesRepo.count({ where: { videoStatus: VideoStatus.Completed } }),
      ]);

    const totalStoriesGenerated = isSandbox !== undefined
      ? await addCostSandboxFilter(this.costRepo.createQueryBuilder('cost').select('COUNT(*)', 'cnt'))
          .getRawOne<{ cnt: string }>().then((r) => toNumber(r?.cnt))
      : await this.storiesRepo.count();

    const avgCostPerStory = totalStoriesGenerated ? aiCostThisMonth / totalStoriesGenerated : 0;
    const avgCostPerImage = totalImagesGenerated ? aiCostThisMonth / totalImagesGenerated : 0;
    const avgCostPerNarrationMinute = totalNarrationSeconds ? aiCostThisMonth / (totalNarrationSeconds / 60) : 0;

    const byProvider = await addSandboxFilter(this.aiUsageRepo
      .createQueryBuilder('ai')
      .select('ai.provider', 'provider')
      .addSelect('COUNT(*)', 'requestCount')
      .addSelect('SUM(CASE WHEN ai.operation = :storyOp THEN 1 ELSE 0 END)', 'storiesGenerated')
      .addSelect('SUM(ai.imagesGenerated)', 'imagesGenerated')
      .addSelect('SUM(ai.audioSeconds)', 'narrationSeconds')
      .addSelect('SUM(ai.estimatedCostUsd)', 'estimatedCostUsd')
      .setParameter('storyOp', AiOperation.StoryGeneration)
      .groupBy('ai.provider'))
      .getRawMany();

    const byModel = await addSandboxFilter(this.aiUsageRepo
      .createQueryBuilder('ai')
      .select('ai.provider', 'provider')
      .addSelect('ai.model', 'model')
      .addSelect('COUNT(*)', 'requestCount')
      .addSelect('SUM(ai.inputTokens)', 'totalInputTokens')
      .addSelect('SUM(ai.outputTokens)', 'totalOutputTokens')
      .addSelect('SUM(ai.imagesGenerated)', 'imagesGenerated')
      .addSelect('SUM(ai.audioSeconds)', 'audioSeconds')
      .addSelect('SUM(ai.estimatedCostUsd)', 'estimatedCostUsd')
      .groupBy('ai.provider')
      .addGroupBy('ai.model'))
      .getRawMany();

    const byOperation = await addSandboxFilter(this.aiUsageRepo
      .createQueryBuilder('ai')
      .select('ai.operation', 'operation')
      .addSelect('COUNT(*)', 'requestCount')
      .addSelect('AVG(ai.estimatedCostUsd)', 'avgCostUsd')
      .addSelect('SUM(ai.estimatedCostUsd)', 'totalCostUsd')
      .groupBy('ai.operation'))
      .getRawMany();

    const topExpensiveStories = await addCostSandboxFilter(this.costRepo
      .createQueryBuilder('cost')
      .leftJoin('stories', 'story', 'story.id = cost.storyId')
      .leftJoin('users', 'user', 'user.id = story.userId')
      .select('cost.storyId', 'storyId')
      .addSelect('story.title', 'title')
      .addSelect('user.email', 'userEmail')
      .addSelect('cost.storyCostUsd', 'storyCostUsd')
      .addSelect('cost.imageCostUsd', 'imageCostUsd')
      .addSelect('cost.audioCostUsd', 'audioCostUsd')
      .addSelect('COALESCE(cost.videoCostUsd, 0)', 'videoCostUsd')
      .addSelect('cost.totalCostUsd', 'totalCostUsd')
      .orderBy('cost.totalCostUsd', 'DESC')
      .limit(10))
      .getRawMany();

    const topExpensiveUsers = await addSandboxFilter(this.aiUsageRepo
      .createQueryBuilder('ai')
      .leftJoin('users', 'user', 'user.id = ai.userId')
      .select('ai.userId', 'userId')
      .addSelect('user.name', 'name')
      .addSelect('user.email', 'email')
      .addSelect('COUNT(DISTINCT ai.storyId)', 'storyCount')
      .addSelect('SUM(ai.imagesGenerated)', 'imagesGenerated')
      .addSelect('SUM(ai.audioSeconds)', 'audioSeconds')
      .addSelect('SUM(ai.estimatedCostUsd)', 'totalAiCostUsd')
      .groupBy('ai.userId')
      .addGroupBy('user.name')
      .addGroupBy('user.email')
      .orderBy('SUM(ai.estimatedCostUsd)', 'DESC')
      .limit(10))
      .getRawMany();

    const universeAnalytics = await addSandboxFilter(this.aiUsageRepo
      .createQueryBuilder('ai')
      .leftJoin('stories', 'story', 'story.id = ai.storyId')
      .leftJoin('universes', 'universe', 'universe.id = story.universeId')
      .select('story.universeId', 'universeId')
      .addSelect('universe.name', 'universeName')
      .addSelect('COUNT(DISTINCT story.id)', 'storyCount')
      .addSelect('SUM(ai.imagesGenerated)', 'imagesGenerated')
      .addSelect('SUM(CASE WHEN ai.operation = :narrationOp THEN 1 ELSE 0 END)', 'audioCount')
      .addSelect('SUM(ai.estimatedCostUsd)', 'totalAiCostUsd')
      .setParameter('narrationOp', AiOperation.Narration)
      .groupBy('story.universeId')
      .addGroupBy('universe.name')
      .orderBy('SUM(ai.estimatedCostUsd)', 'DESC')
      .limit(20))
      .getRawMany();

    const qaAvgRows = await this.dataSource.query<Array<Record<string, unknown>>>(
      `SELECT
         AVG("overallConfidence")  AS avgConfidence,
         AVG("avgIdentityScore")   AS avgIdentity,
         AVG("avgStoryScore")      AS avgStory,
         AVG("pagesRetried")       AS avgRetries,
         COUNT(*)                  AS totalRuns,
         ROUND(100.0 * COUNT(*) FILTER (WHERE "overallStatus" = 'pass') / NULLIF(COUNT(*), 0), 1) AS passRate
       FROM story_qa_runs
       WHERE "createdAt" >= NOW() - INTERVAL '30 days'`,
    );
    const qaAvg = qaAvgRows[0] ?? null;

    return {
      aiCostToday,
      aiCostThisMonth,
      totalStoriesGenerated,
      totalImagesGenerated,
      totalNarrationSeconds,
      totalVideosGenerated,
      avgCostPerStory,
      avgCostPerImage,
      avgCostPerNarrationMinute,
      byProvider,
      byModel,
      byOperation,
      topExpensiveStories,
      topExpensiveUsers,
      universeAnalytics,
      isSandbox: isSandbox ?? null,
      // QA summary — added backward-compatibly (null when no QA runs exist)
      qaAvgConfidence:    qaAvg?.avgconfidence   !== undefined ? Number(qaAvg.avgconfidence)   : null,
      qaAvgIdentity:      qaAvg?.avgidentity     !== undefined ? Number(qaAvg.avgidentity)     : null,
      qaAvgStory:         qaAvg?.avgstory        !== undefined ? Number(qaAvg.avgstory)        : null,
      qaAvgRetries:       qaAvg?.avgretries      !== undefined ? Number(qaAvg.avgretries)      : null,
      qaPassRate:         qaAvg?.passrate        !== undefined ? Number(qaAvg.passrate)        : null,
      qaTotalRuns:        qaAvg?.totalruns       !== undefined ? Number(qaAvg.totalruns)       : 0,
    };
  }

  async getGenerationRuns(params: {
    page?: number;
    limit?: number;
    days?: number;
    status?: string;
    sandbox?: boolean;
  } = {}) {
    const { page = 1, limit = 25, days = 30, status, sandbox } = params;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const offset = (page - 1) * limit;

    const sandboxClause = sandbox !== undefined ? `AND s."isSandbox" = ${sandbox}` : '';
    const statusClause = status ? `AND s.status = '${status.replace(/'/g, "''")}'` : '';

    const [rows, countResult] = await Promise.all([
      this.dataSource.query<Array<Record<string, unknown>>>(
        `SELECT
           s.id AS "storyId",
           s.title AS "storyTitle",
           s.status AS "status",
           s."createdAt" AS "createdAt",
           s."storyMode" AS "storyMode",
           u.name AS "universeName",
           usr.name AS "userName",
           usr.email AS "userEmail",
           qr."overallConfidence" AS "qaConfidence",
           qr."overallStatus" AS "qaStatus",
           qr."avgIdentityScore" AS "avgIdentityScore",
           qr."avgStoryScore" AS "avgStoryScore",
           qr."pagesRetried" AS "pagesRetried",
           qr."storyPromptVersion" AS "storyPromptVersion",
           qr."imagePromptVersion" AS "imagePromptVersion",
           qr."qaVersion" AS "qaVersion",
           qr."generationTimeMs" AS "qaTimeMs",
           gc."storyCostUsd" AS "storyCostUsd",
           gc."imageCostUsd" AS "imageCostUsd",
           gc."audioCostUsd" AS "audioCostUsd",
           gc."totalCostUsd" AS "totalCostUsd",
           EXTRACT(EPOCH FROM (j."completedAt" - j."startedAt"))::int AS "durationSeconds"
         FROM stories s
         LEFT JOIN universes u ON u.id = s."universeId"
         LEFT JOIN users usr ON usr.id = s."userId"
         LEFT JOIN LATERAL (
           SELECT * FROM story_qa_runs WHERE "storyId" = s.id ORDER BY "createdAt" DESC LIMIT 1
         ) qr ON true
         LEFT JOIN story_generation_costs gc ON gc."storyId" = s.id
         LEFT JOIN LATERAL (
           SELECT * FROM generation_jobs WHERE "storyId" = s.id ORDER BY "createdAt" DESC LIMIT 1
         ) j ON true
         WHERE s."createdAt" >= $1 ${sandboxClause} ${statusClause}
         ORDER BY s."createdAt" DESC
         LIMIT $2 OFFSET $3`,
        [cutoff, limit, offset],
      ),
      this.dataSource.query<Array<{ cnt: string }>>(
        `SELECT COUNT(*)::int AS cnt FROM stories s WHERE s."createdAt" >= $1 ${sandboxClause} ${statusClause}`,
        [cutoff],
      ),
    ]);

    const total = Number(countResult[0]?.cnt ?? 0);
    return {
      items: rows.map((r) => ({
        storyId:             String(r.storyId ?? ''),
        storyTitle:          r.storyTitle ? String(r.storyTitle) : null,
        status:              String(r.status ?? ''),
        createdAt:           r.createdAt,
        storyMode:           r.storyMode ? String(r.storyMode).replace(/_/g, ' ') : null,
        universeName:        r.universeName ? String(r.universeName) : null,
        userName:            r.userName ? String(r.userName) : null,
        userEmail:           r.userEmail ? String(r.userEmail) : null,
        overallConfidence:   r.qaConfidence !== null && r.qaConfidence !== undefined ? Math.round(Number(r.qaConfidence) * 10) / 10 : null,
        qaStatus:            r.qaStatus ? String(r.qaStatus) : null,
        avgIdentityScore:    r.avgIdentityScore !== null && r.avgIdentityScore !== undefined ? Math.round(Number(r.avgIdentityScore) * 10) / 10 : null,
        avgStoryScore:       r.avgStoryScore !== null && r.avgStoryScore !== undefined ? Math.round(Number(r.avgStoryScore) * 10) / 10 : null,
        pagesRetried:        Number(r.pagesRetried ?? 0),
        storyPromptVersion:  r.storyPromptVersion ? String(r.storyPromptVersion) : null,
        imagePromptVersion:  r.imagePromptVersion ? String(r.imagePromptVersion) : null,
        qaVersion:           r.qaVersion ? String(r.qaVersion) : null,
        storyCostUsd:        r.storyCostUsd !== null && r.storyCostUsd !== undefined ? Number(r.storyCostUsd) : null,
        imageCostUsd:        r.imageCostUsd !== null && r.imageCostUsd !== undefined ? Number(r.imageCostUsd) : null,
        audioCostUsd:        r.audioCostUsd !== null && r.audioCostUsd !== undefined ? Number(r.audioCostUsd) : null,
        totalCostUsd:        r.totalCostUsd !== null && r.totalCostUsd !== undefined ? Number(r.totalCostUsd) : null,
        durationSeconds:     r.durationSeconds !== null && r.durationSeconds !== undefined ? Number(r.durationSeconds) : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getAiLogs(params: {
    page?: number;
    limit?: number;
    search?: string;
    operation?: string;
    provider?: string;
    sandbox?: boolean;
  } = {}) {
    const { page = 1, limit = 50, search, operation, provider, sandbox } = params;
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];
    let i = 1;

    if (provider) { whereClauses.push(`al.provider ILIKE $${i++}`); queryParams.push(`%${provider}%`); }
    if (operation) { whereClauses.push(`al.operation = $${i++}`); queryParams.push(operation); }
    if (sandbox !== undefined) { whereClauses.push(`al."isSandbox" = $${i++}`); queryParams.push(sandbox); }
    if (search?.trim()) {
      whereClauses.push(`(al.model ILIKE $${i} OR u.email ILIKE $${i} OR s.title ILIKE $${i})`);
      queryParams.push(`%${search.trim()}%`);
      i++;
    }

    const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    queryParams.push(limit, offset);

    const [rows, countRows] = await Promise.all([
      this.dataSource.query<Array<Record<string, unknown>>>(
        `SELECT al.id, al."userId", al."storyId",
                al.provider, al.model, al.operation,
                al."inputTokens", al."outputTokens",
                al."imagesGenerated", al."audioSeconds",
                al."estimatedCostUsd",
                al."isSandbox", al."createdAt",
                u.email AS "userEmail", s.title AS "storyTitle"
         FROM ai_usage_logs al
         LEFT JOIN users u ON u.id = al."userId"
         LEFT JOIN stories s ON s.id = al."storyId"
         ${whereStr}
         ORDER BY al."createdAt" DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        queryParams,
      ),
      this.dataSource.query<Array<{ cnt: string }>>(
        `SELECT COUNT(*)::int AS cnt
         FROM ai_usage_logs al
         LEFT JOIN users u ON u.id = al."userId"
         LEFT JOIN stories s ON s.id = al."storyId"
         ${whereStr}`,
        queryParams.slice(0, -2),
      ),
    ]);

    return {
      items: rows.map((r) => ({
        id:              String(r.id ?? ''),
        userId:          r.userId ? String(r.userId) : null,
        storyId:         r.storyId ? String(r.storyId) : null,
        provider:        String(r.provider ?? ''),
        model:           String(r.model ?? ''),
        operation:       String(r.operation ?? ''),
        inputTokens:     Number(r.inputTokens ?? 0),
        outputTokens:    Number(r.outputTokens ?? 0),
        imagesGenerated: Number(r.imagesGenerated ?? 0),
        audioSeconds:    Number(r.audioSeconds ?? 0),
        estimatedCostUsd:Number(r.estimatedCostUsd ?? 0),
        isSandbox:       Boolean(r.isSandbox),
        createdAt:       r.createdAt,
        userEmail:       r.userEmail ? String(r.userEmail) : null,
        storyTitle:      r.storyTitle ? String(r.storyTitle) : null,
      })),
      total:      Number(countRows[0]?.cnt ?? 0),
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.cnt ?? 0) / limit)),
    };
  }

  async listInfluencers(page = 1, limit = 20, search?: string) {
    const qb = this.influencersRepo.createQueryBuilder('influencer');
    if (search?.trim()) {
      qb.andWhere('(influencer.name ILIKE :q OR influencer.code ILIKE :q OR influencer.email ILIKE :q OR influencer.platform ILIKE :q)', {
        q: `%${search.trim()}%`,
      });
    }
    const [influencers, total] = await qb.orderBy('influencer.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const stats = await Promise.all(
      influencers.map(async (influencer) => {
        const [usersReferred, storiesGenerated, revenueRow, commissionRow, paidRow] = await Promise.all([
          this.referralsRepo.count({ where: { influencerId: influencer.id } }),
          this.referralsRepo
            .createQueryBuilder('ref')
            .leftJoin('stories', 'story', 'story.userId = ref.userId')
            .where('ref.influencerId = :id', { id: influencer.id })
            .select('COUNT(DISTINCT story.id)', 'count')
            .getRawOne<{ count: string }>(),
          this.referralsRepo
            .createQueryBuilder('ref')
            .select('SUM(ref.revenueInr)', 'sum')
            .where('ref.influencerId = :id', { id: influencer.id })
            .getRawOne<{ sum: string }>(),
          this.referralsRepo
            .createQueryBuilder('ref')
            .select('SUM(ref.commissionInr)', 'sum')
            .where('ref.influencerId = :id', { id: influencer.id })
            .getRawOne<{ sum: string }>(),
          this.referralsRepo
            .createQueryBuilder('ref')
            .select('SUM(CASE WHEN ref.commissionPaid = true THEN ref.commissionInr ELSE 0 END)', 'sum')
            .where('ref.influencerId = :id', { id: influencer.id })
            .getRawOne<{ sum: string }>(),
        ]);

        return {
          ...influencer,
          usersReferred,
          storiesGenerated: toNumber(storiesGenerated?.count),
          revenueGeneratedInr: toNumber(revenueRow?.sum),
          commissionOwedInr: toNumber(commissionRow?.sum),
          commissionPaidInr: toNumber(paidRow?.sum),
        };
      }),
    );
    return makePage(stats, total, page, limit);
  }

  async createInfluencer(body: Partial<Influencer>) {
    return this.influencersService.createInfluencer(body);
  }

  async updateInfluencer(id: string, body: Partial<Influencer>) {
    const influencer = await this.influencersRepo.findOne({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer not found');
    Object.assign(influencer, body);
    return this.influencersRepo.save(influencer);
  }

  async createPlatformCoupon(dto: {
    code: string;
    discountType: CouponDiscountType;
    discountValue: number;
    maxDiscountAmount?: number | null;
    usageLimit?: number | null;
    perUserUsageLimit?: number | null;
    minimumOrderAmount?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    isActive?: boolean;
    appliesToProductIds?: string[] | null;
    appliesToCategoryIds?: string[] | null;
  }) {
    const couponRepo = this.dataSource.getRepository(InfluencerCouponCode);
    const existing = await couponRepo.findOne({
      where: { code: ILike(dto.code.trim().toUpperCase()), isDeleted: false },
    });
    if (existing) {
      throw new ConflictException(`Coupon code "${dto.code.toUpperCase()}" already exists`);
    }
    return couponRepo.save(
      couponRepo.create({
        code: dto.code.trim().toUpperCase(),
        couponType: CouponType.Platform,
        influencerId: null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        usageLimit: dto.usageLimit ?? null,
        perUserUsageLimit: dto.perUserUsageLimit ?? null,
        minimumOrderAmount: dto.minimumOrderAmount ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
        appliesToProductIds: dto.appliesToProductIds ?? null,
        appliesToCategoryIds: dto.appliesToCategoryIds ?? null,
      }),
    );
  }

  async updateCoupon(
    id: string,
    dto: Partial<{
      code: string;
      discountType: CouponDiscountType;
      discountValue: number;
      maxDiscountAmount: number | null;
      usageLimit: number | null;
      perUserUsageLimit: number | null;
      minimumOrderAmount: number | null;
      startsAt: string | null;
      expiresAt: string | null;
      isActive: boolean;
    }>,
  ) {
    const couponRepo = this.dataSource.getRepository(InfluencerCouponCode);
    const coupon = await couponRepo.findOneOrFail({ where: { id, isDeleted: false } });
    if (dto.code) coupon.code = dto.code.trim().toUpperCase();
    if (dto.discountType !== undefined) coupon.discountType = dto.discountType;
    if (dto.discountValue !== undefined) coupon.discountValue = dto.discountValue;
    if ('maxDiscountAmount' in dto) coupon.maxDiscountAmount = dto.maxDiscountAmount ?? null;
    if ('usageLimit' in dto) coupon.usageLimit = dto.usageLimit ?? null;
    if ('perUserUsageLimit' in dto) coupon.perUserUsageLimit = dto.perUserUsageLimit ?? null;
    if ('minimumOrderAmount' in dto) coupon.minimumOrderAmount = dto.minimumOrderAmount ?? null;
    if ('startsAt' in dto) coupon.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if ('expiresAt' in dto) coupon.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.isActive !== undefined) coupon.isActive = dto.isActive;
    return couponRepo.save(coupon);
  }

  async listAllCoupons(params: {
    page?: number;
    limit?: number;
    couponType?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const repo = this.dataSource.getRepository(InfluencerCouponCode);
    const qb = repo
      .createQueryBuilder('c')
      .where('c.isDeleted = false')
      .leftJoinAndSelect('c.influencer', 'influencer')
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (params.couponType) {
      qb.andWhere('c.couponType = :couponType', { couponType: params.couponType });
    }
    if (params.isActive !== undefined) {
      qb.andWhere('c.isActive = :isActive', { isActive: params.isActive });
    }
    if (params.search) {
      qb.andWhere('c.code ILIKE :search', { search: `%${params.search}%` });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async backfillAiCosts(): Promise<{ updatedLogs: number; updatedStories: number }> {
    const [inputCostPer1M, outputCostPer1M, imageCostPerImage, ttsCostPerChar] = await Promise.all([
      this.getSetting('GEMINI_INPUT_COST_PER_1M_TOKENS', 0.10),
      this.getSetting('GEMINI_OUTPUT_COST_PER_1M_TOKENS', 0.40),
      this.getSetting('OPENAI_IMAGE_COST_PER_IMAGE', 0.011),
      this.getSetting('OPENAI_TTS_COST_PER_CHAR', 0.000015),
    ]);
    // Narration stored as audioSeconds; derive approx chars via 5 chars/word ÷ 0.55 s/word
    const ttsCostPerSecond = ttsCostPerChar * (5 / 0.55);

    const logs = await this.aiUsageRepo
      .createQueryBuilder('log')
      .where('log.estimatedCostUsd = :zero', { zero: 0 })
      .andWhere('(log.inputTokens > 0 OR log.outputTokens > 0 OR log.imagesGenerated > 0 OR log.audioSeconds > 0)')
      .getMany();

    const affectedStoryIds = new Set<string>();
    let updatedLogs = 0;

    for (const log of logs) {
      let cost = 0;
      if (log.operation === AiOperation.StoryGeneration) {
        cost = ((log.inputTokens ?? 0) * inputCostPer1M + (log.outputTokens ?? 0) * outputCostPer1M) / 1_000_000;
      } else if (log.operation === AiOperation.ImageGeneration) {
        cost = (log.imagesGenerated ?? 0) * imageCostPerImage;
      } else if (log.operation === AiOperation.Narration) {
        cost = (log.audioSeconds ?? 0) * ttsCostPerSecond;
      }

      if (cost > 0) {
        await this.aiUsageRepo.update(log.id, { estimatedCostUsd: cost });
        updatedLogs++;
        if (log.storyId) affectedStoryIds.add(log.storyId);
      }
    }

    // Re-aggregate story_generation_costs for every affected story
    let updatedStories = 0;
    for (const storyId of affectedStoryIds) {
      const storyLogs = await this.aiUsageRepo.find({ where: { storyId } });
      let storyCostUsd = 0, imageCostUsd = 0, audioCostUsd = 0;
      for (const log of storyLogs) {
        const c = toNumber(log.estimatedCostUsd);
        if (log.operation === AiOperation.StoryGeneration) storyCostUsd += c;
        else if (log.operation === AiOperation.ImageGeneration) imageCostUsd += c;
        else if (log.operation === AiOperation.Narration) audioCostUsd += c;
      }
      const totalCostUsd = storyCostUsd + imageCostUsd + audioCostUsd;

      const existing = await this.costRepo.findOne({ where: { storyId } });
      if (existing) {
        await this.costRepo.update({ storyId }, { storyCostUsd, imageCostUsd, audioCostUsd, totalCostUsd });
      } else {
        const story = await this.storiesRepo.findOne({ where: { id: storyId } });
        if (story) {
          await this.costRepo.save(this.costRepo.create({ storyId, userId: story.userId, storyCostUsd, imageCostUsd, audioCostUsd, totalCostUsd }));
        }
      }
      updatedStories++;
    }

    return { updatedLogs, updatedStories };
  }

  async getMerchandiseAnalytics() {
    const rows = await this.ordersRepo
      .createQueryBuilder('merchOrder')
      .select('merchOrder.productType', 'productType')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(merchOrder.amountInr)', 'revenueInr')
      .groupBy('merchOrder.productType')
      .getRawMany();

    const revenueByProduct = rows.map((row) => ({
      productType: row.productType,
      count: Number(row.count),
      revenueInr: toNumber(row.revenueInr),
    }));

    const summary = revenueByProduct.reduce(
      (acc, row) => {
        acc.totalRevenueInr += row.revenueInr;
        switch (row.productType) {
          case ProductType.Poster:         acc.posterPdfsGenerated += row.count; break;
          case ProductType.Certificate:    acc.certificatePdfsGenerated += row.count; break;
          case ProductType.StickerSheet:   acc.stickerSheetsGenerated += row.count; break;
          case ProductType.Video:          acc.videosExported += row.count; break;
          case ProductType.Book:           acc.booksOrdered += row.count; break;
        }
        return acc;
      },
      {
        posterPdfsGenerated: 0,
        certificatePdfsGenerated: 0,
        stickerSheetsGenerated: 0,
        videosExported: 0,
        booksOrdered: 0,
        totalRevenueInr: 0,
      },
    );

    return { ...summary, revenueByProduct };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getSetting(key: string, fallback: number): Promise<number> {
    const row = await this.settingsRepo.findOne({ where: { key } });
    if (row) return Number(row.value);
    // fall back to env var then hardcoded default
    const envAliases: Record<string, string[]> = {
      USD_INR_RATE: ['USD_INR_RATE', 'USD_TO_INR'],
      AI_DAILY_COST_WARNING_USD: ['AI_DAILY_COST_WARNING_USD', 'AI_DAILY_COST_WARNING'],
      AI_MONTHLY_COST_WARNING_USD: ['AI_MONTHLY_COST_WARNING_USD', 'AI_MONTHLY_COST_WARNING'],
      AI_DAILY_COST_HARD_LIMIT_USD: ['AI_DAILY_COST_HARD_LIMIT_USD'],
      AI_MONTHLY_COST_HARD_LIMIT_USD: ['AI_MONTHLY_COST_HARD_LIMIT_USD'],
      FREE_SIGNUP_CREDITS: ['FREE_SIGNUP_CREDITS'],
      BASIC_PLAN_PAGES: ['BASIC_PLAN_PAGES'],
      STANDARD_PLAN_PAGES: ['STANDARD_PLAN_PAGES'],
      PREMIUM_PLAN_PAGES: ['PREMIUM_PLAN_PAGES'],
      MAX_IMAGES_PER_STORY_DEV: ['MAX_IMAGES_PER_STORY_DEV'],
      MAX_IMAGES_PER_STORY_PROD: ['MAX_IMAGES_PER_STORY_PROD'],
    };
    const envKeys = envAliases[key] ?? [key];
    for (const envKey of envKeys) {
      const raw = process.env[envKey];
      if (raw !== undefined) return Number(raw);
    }
    return fallback;
  }

  private async getSettingString(key: string, fallback: string): Promise<string> {
    const row = await this.settingsRepo.findOne({ where: { key } });
    if (row) return row.value;
    const raw = process.env[key] ?? fallback;
    return raw;
  }

  private async getSettingBool(key: string, fallback: boolean): Promise<boolean> {
    const def = SETTING_DEFAULTS[key];
    const row = await this.settingsRepo.findOne({ where: { key } });
    if (row) return row.value === 'true' || row.value === '1';
    if (process.env[key]) return process.env[key] === 'true' || process.env[key] === '1';
    return def ? def.value === 'true' : fallback;
  }

  private async ensureDefaultSettings() {
    const existing = await this.settingsRepo.find({ select: ['key'] });
    const existingKeys = new Set(existing.map((row) => row.key));
    const missing = Object.entries(SETTING_DEFAULTS).filter(([key]) => !existingKeys.has(key));
    if (missing.length === 0) return;

    await this.settingsRepo.insert(
      missing.map(([key, def]) => ({
        key,
        value: def.value,
        type: def.type,
        description: def.description,
      })),
    );
  }

  private async sumOrderRevenue(start?: Date, isSandbox?: boolean) {
    // All v2 orders (merchandise + credit purchases) — this is where all real orders land
    const cqb = this.commerceOrdersRepo
      .createQueryBuilder('co')
      .select('SUM(co.totalAmount)', 'sum')
      .where('co.status NOT IN (:...excluded)', {
        excluded: [CommerceOrderStatus.Cancelled, CommerceOrderStatus.Failed, CommerceOrderStatus.Refunded, CommerceOrderStatus.PendingPayment],
      })
      .andWhere('co.isDeleted = false');
    if (start) cqb.andWhere('co.createdAt >= :start', { start });
    if (isSandbox !== undefined) cqb.andWhere('co.isSandbox = :isSandbox', { isSandbox });
    const crow = await cqb.getRawOne<{ sum: string }>();
    const v2Revenue = toNumber(crow?.sum);

    // Legacy merchandise_orders table (old orders before v2 migration)
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .select('SUM(o.amountInr)', 'sum')
      .where('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.Cancelled, OrderStatus.Failed, OrderStatus.Refunded, OrderStatus.PendingPayment],
      })
      .andWhere('o.isDeleted = false');
    if (start) qb.andWhere('o.createdAt >= :start', { start });
    if (isSandbox !== undefined) qb.andWhere('o.isSandbox = :isSandbox', { isSandbox });
    const row = await qb.getRawOne<{ sum: string }>();
    const legacyRevenue = toNumber(row?.sum);

    return v2Revenue + legacyRevenue;
  }

  private async sumAiCost(start?: Date, isSandbox?: boolean) {
    const qb = this.aiUsageRepo.createQueryBuilder('ai').select('SUM(ai.estimatedCostUsd)', 'sum');
    if (start) qb.andWhere('ai.createdAt >= :start', { start });
    if (isSandbox !== undefined) qb.andWhere('ai.isSandbox = :isSandbox', { isSandbox });
    const row = await qb.getRawOne<{ sum: string }>();
    return toNumber(row?.sum);
  }

  private getDateBounds() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return [todayStart, monthStart] as const;
  }

  private jobDurationMs(job: GenerationJob): number {
    const started = job.startedAt ?? job.createdAt;
    const end = job.completedAt ?? new Date();
    return end.getTime() - started.getTime();
  }

  async getQaDashboard(params: { days?: number } = {}) {
    const days = params.days ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const [agg, failedPages, recentRuns, trend] = await Promise.all([
      this.dataSource.query<Array<{
        totalruns: string; avgoverallconfidence: string;
        avgidentityscore: string; avgstoryscore: string;
        avgexpressionscore: string; avgdialoguescoreval: string;
        avgcompositionscore: string; avgnarrationscore: string;
        passrate: string; retryrate: string;
        storiesacceptedfirstattempt: string; storiesrequiringretry: string;
      }>>(
        `SELECT
           COUNT(*)::int AS totalruns,
           COALESCE(AVG("overallConfidence"), 0) AS avgoverallconfidence,
           COALESCE(AVG("avgIdentityScore"), 0) AS avgidentityscore,
           COALESCE(AVG("avgStoryScore"), 0) AS avgstoryscore,
           COALESCE(AVG("avgExpressionScore"), 0) AS avgexpressionscore,
           COALESCE(AVG("avgDialogueScore"), 0) AS avgdialoguescoreval,
           COALESCE(AVG("avgCompositionScore"), 0) AS avgcompositionscore,
           COALESCE(AVG("avgNarrationScore"), 0) AS avgnarrationscore,
           CASE WHEN COUNT(*) = 0 THEN 0 ELSE
             SUM(CASE WHEN "overallStatus" = 'pass' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 END AS passrate,
           CASE WHEN COUNT(*) = 0 THEN 0 ELSE
             SUM(CASE WHEN "pagesRetried" > 0 THEN 1 ELSE 0 END)::float / COUNT(*) * 100 END AS retryrate,
           SUM(CASE WHEN "pagesRetried" = 0 AND "overallStatus" IN ('pass','pass_with_warning') THEN 1 ELSE 0 END) AS storiesacceptedfirstattempt,
           SUM(CASE WHEN "pagesRetried" > 0 THEN 1 ELSE 0 END) AS storiesrequiringretry
         FROM story_qa_runs
         WHERE "createdAt" >= $1`,
        [cutoff],
      ),
      this.dataSource.query<Array<{ failedpages: string }>>(
        `SELECT COUNT(*)::int AS failedpages FROM story_qa_pages WHERE accepted = false AND "createdAt" >= $1`,
        [cutoff],
      ),
      this.dataSource.query<Array<{
        id: string; storyId: string; overallConfidence: string | null;
        overallStatus: string; avgIdentityScore: string | null;
        pagesRetried: string; createdAt: string;
        story_title: string | null; user_email: string | null;
      }>>(
        `SELECT r.id, r."storyId", r."overallConfidence", r."overallStatus",
                r."avgIdentityScore", r."pagesRetried", r."createdAt",
                s.title AS story_title, u.email AS user_email
         FROM story_qa_runs r
         LEFT JOIN stories s ON s.id = r."storyId"
         LEFT JOIN users u ON u.id = r."userId"
         WHERE r."createdAt" >= $1
         ORDER BY r."createdAt" DESC
         LIMIT 30`,
        [cutoff],
      ),
      this.dataSource.query<Array<{ day: string; avgconfidence: string; cnt: string }>>(
        `SELECT DATE_TRUNC('day', "createdAt")::date::text AS day,
                AVG("overallConfidence") AS avgconfidence,
                COUNT(*)::int AS cnt
         FROM story_qa_runs
         WHERE "createdAt" >= $1
         GROUP BY 1
         ORDER BY 1 DESC`,
        [cutoff],
      ),
    ]);

    // Aggregate top failure reasons from qa_pages
    const failureRows = await this.dataSource.query<Array<{ issue: string; cnt: string }>>(
      `SELECT jsonb_array_elements_text(issues) AS issue, COUNT(*)::int AS cnt
       FROM story_qa_pages
       WHERE "createdAt" >= $1 AND issues IS NOT NULL AND issues != '[]'::jsonb
       GROUP BY 1
       ORDER BY 2 DESC
       LIMIT 15`,
      [cutoff],
    ).catch(() => [] as Array<{ issue: string; cnt: string }>);

    const a = agg[0] ?? {};
    return {
      totalRuns:                    Number(a.totalruns ?? 0),
      avgOverallConfidence:         Math.round(Number(a.avgoverallconfidence ?? 0) * 10) / 10,
      avgIdentityScore:             Math.round(Number(a.avgidentityscore ?? 0) * 10) / 10,
      avgStoryScore:                Math.round(Number(a.avgstoryscore ?? 0) * 10) / 10,
      avgExpressionScore:           Math.round(Number(a.avgexpressionscore ?? 0) * 10) / 10,
      avgDialogueScore:             Math.round(Number(a.avgdialoguescoreval ?? 0) * 10) / 10,
      avgCompositionScore:          Math.round(Number(a.avgcompositionscore ?? 0) * 10) / 10,
      avgNarrationScore:            Math.round(Number(a.avgnarrationscore ?? 0) * 10) / 10,
      passRate:                     Math.round(Number(a.passrate ?? 0) * 10) / 10,
      retryRate:                    Math.round(Number(a.retryrate ?? 0) * 10) / 10,
      storiesAcceptedFirstAttempt:  Number(a.storiesacceptedfirstattempt ?? 0),
      storiesRequiringRetry:        Number(a.storiesrequiringretry ?? 0),
      failedPages:                  Number(failedPages[0]?.failedpages ?? 0),
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        storyId: r.storyId,
        storyTitle: r.story_title ?? null,
        userEmail: r.user_email ?? null,
        overallConfidence: r.overallConfidence !== null ? Number(r.overallConfidence) : null,
        overallStatus: r.overallStatus,
        avgIdentityScore: r.avgIdentityScore !== null ? Math.round(Number(r.avgIdentityScore) * 10) / 10 : null,
        pagesRetried: Number(r.pagesRetried),
        createdAt: r.createdAt,
      })),
      topFailureReasons: failureRows.map((f) => ({ reason: f.issue, count: Number(f.cnt) })),
      confidenceTrend: trend.map((t) => ({
        date: t.day,
        avgConfidence: Math.round(Number(t.avgconfidence) * 10) / 10,
        count: Number(t.cnt),
      })),
    };
  }
}

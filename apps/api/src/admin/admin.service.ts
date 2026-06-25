import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { StoryArc } from '../story-arcs/story-arc.entity';
import { Story, StoryStatus, StoryTheme, VideoStatus } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { User, UserPlan, UserRole } from '../users/user.entity';
import { PlatformSetting, SETTING_DEFAULTS, normalizeSettingValue } from './platform-setting.entity';

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
export class AdminService {
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
    private readonly dataSource: DataSource,
    private readonly influencersService: InfluencersService,
  ) {}

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

  async upsertSetting(key: string, value: unknown) {
    const def = SETTING_DEFAULTS[key];
    const type = def?.type ?? (await this.settingsRepo.findOne({ where: { key } }))?.type ?? 'string';
    const description = def?.description ?? null;
    await this.settingsRepo.upsert({ key, value: normalizeSettingValue(type, value), type, description }, ['key']);
    const row = await this.settingsRepo.findOne({ where: { key } });
    return row ?? { key, value: normalizeSettingValue(type, value), type, description, updatedAt: new Date() };
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
      this.sumPayments(todayStart),
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

  async getDashboard() {
    const [todayStart, monthStart] = this.getDateBounds();
    const [usdToInr, dailyWarning, monthlyWarning, dailyHardLimit, monthlyHardLimit, displayCurrency] = await Promise.all([
      this.getSetting('USD_INR_RATE', 96),
      this.getSetting('AI_DAILY_COST_WARNING_USD', 10),
      this.getSetting('AI_MONTHLY_COST_WARNING_USD', 200),
      this.getSetting('AI_DAILY_COST_HARD_LIMIT_USD', 25),
      this.getSetting('AI_MONTHLY_COST_HARD_LIMIT_USD', 500),
      this.getSettingString('DISPLAY_CURRENCY', 'INR'),
    ]);

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
      this.usersRepo.count(),
      this.universesRepo.count(),
      this.storiesRepo.count(),
      this.storiesRepo.count({ where: { createdAt: MoreThanOrEqual(todayStart) } as any }),
      this.jobsRepo.count({ where: { status: In(ACTIVE_JOB_STATUSES) } as any }),
      this.ordersRepo.count({ where: { status: OrderStatus.Pending } }),
      this.ordersRepo.count({
        where: { status: OrderStatus.Shipped, updatedAt: MoreThanOrEqual(todayStart) } as any,
      }),
      this.sumPayments(),
      this.sumPayments(todayStart),
      this.sumPayments(monthStart),
      this.sumAiCost(),
      this.sumAiCost(todayStart),
      this.sumAiCost(monthStart),
      this.storiesRepo
        .createQueryBuilder('story')
        .select('story.theme', 'theme')
        .addSelect('COUNT(*)', 'count')
        .where('story.theme IS NOT NULL')
        .groupBy('story.theme')
        .orderBy('COUNT(*)', 'DESC')
        .limit(1)
        .getRawOne<{ theme: StoryTheme; count: string }>(),
      this.ordersRepo
        .createQueryBuilder('merchOrder')
        .select('merchOrder.productType', 'productType')
        .addSelect('COUNT(*)', 'count')
        .groupBy('merchOrder.productType')
        .orderBy('COUNT(*)', 'DESC')
        .limit(1)
        .getRawOne<{ productType: ProductType; count: string }>(),
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

  async getAiAnalytics() {
    const [todayStart, monthStart] = this.getDateBounds();
    const [aiCostToday, aiCostThisMonth, totalStoriesGenerated, totalImagesGenerated, totalNarrationSeconds, totalVideosGenerated] =
      await Promise.all([
        this.sumAiCost(todayStart),
        this.sumAiCost(monthStart),
        this.storiesRepo.count(),
        this.aiUsageRepo
          .createQueryBuilder('ai')
          .select('COALESCE(SUM(ai.imagesGenerated), 0)', 'sum')
          .where('ai.operation = :op', { op: AiOperation.ImageGeneration })
          .getRawOne<{ sum: string }>()
          .then((r) => toNumber(r?.sum)),
        this.aiUsageRepo
          .createQueryBuilder('ai')
          .select('COALESCE(SUM(ai.audioSeconds), 0)', 'sum')
          .where('ai.operation = :op', { op: AiOperation.Narration })
          .getRawOne<{ sum: string }>()
          .then((r) => toNumber(r?.sum)),
        this.storiesRepo.count({ where: { videoStatus: VideoStatus.Completed } }),
      ]);

    const avgCostPerStory = totalStoriesGenerated ? aiCostThisMonth / totalStoriesGenerated : 0;
    const avgCostPerImage = totalImagesGenerated ? aiCostThisMonth / totalImagesGenerated : 0;
    const avgCostPerNarrationMinute = totalNarrationSeconds ? aiCostThisMonth / (totalNarrationSeconds / 60) : 0;

    const byProvider = await this.aiUsageRepo
      .createQueryBuilder('ai')
      .select('ai.provider', 'provider')
      .addSelect('COUNT(*)', 'requestCount')
      .addSelect('SUM(CASE WHEN ai.operation = :storyOp THEN 1 ELSE 0 END)', 'storiesGenerated')
      .addSelect('SUM(ai.imagesGenerated)', 'imagesGenerated')
      .addSelect('SUM(ai.audioSeconds)', 'narrationSeconds')
      .addSelect('SUM(ai.estimatedCostUsd)', 'estimatedCostUsd')
      .setParameter('storyOp', AiOperation.StoryGeneration)
      .groupBy('ai.provider')
      .getRawMany();

    const byModel = await this.aiUsageRepo
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
      .addGroupBy('ai.model')
      .getRawMany();

    const byOperation = await this.aiUsageRepo
      .createQueryBuilder('ai')
      .select('ai.operation', 'operation')
      .addSelect('COUNT(*)', 'requestCount')
      .addSelect('AVG(ai.estimatedCostUsd)', 'avgCostUsd')
      .addSelect('SUM(ai.estimatedCostUsd)', 'totalCostUsd')
      .groupBy('ai.operation')
      .getRawMany();

    const topExpensiveStories = await this.costRepo
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
      .limit(10)
      .getRawMany();

    const topExpensiveUsers = await this.aiUsageRepo
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
      .limit(10)
      .getRawMany();

    const universeAnalytics = await this.aiUsageRepo
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
      .limit(20)
      .getRawMany();

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
      this.getSetting('OPENAI_IMAGE_COST_PER_IMAGE', 0.04),
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

  private async sumPayments(start?: Date) {
    const qb = this.paymentsRepo
      .createQueryBuilder('payment')
      .select('SUM(payment.amountInr)', 'sum')
      .where('payment.status = :status', { status: PaymentStatus.Captured });
    if (start) qb.andWhere('payment.createdAt >= :start', { start });
    const row = await qb.getRawOne<{ sum: string }>();
    return toNumber(row?.sum);
  }

  private async sumAiCost(start?: Date) {
    const qb = this.aiUsageRepo.createQueryBuilder('ai').select('SUM(ai.estimatedCostUsd)', 'sum');
    if (start) qb.andWhere('ai.createdAt >= :start', { start });
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
}

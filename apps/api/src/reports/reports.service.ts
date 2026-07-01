import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, ILike, Repository } from 'typeorm';

import { AiUsageLog } from '../ai/entities/ai-usage-log.entity';
import { StoryGenerationCost } from '../ai/entities/story-generation-cost.entity';
import { PlatformSetting } from '../admin/platform-setting.entity';
import { GenerationJob } from '../generation/generation-job.entity';
import { InfluencerCommission } from '../influencers/influencer-commission.entity';
import { InfluencerCouponCode } from '../influencers/influencer-coupon-code.entity';
import { Influencer } from '../influencers/influencer.entity';
import { Product } from '../merchandise/catalog/product.entity';
import { ProductCategory } from '../merchandise/catalog/product-category.entity';
import { OrderPaymentDetail } from '../merchandise/payments/order-payment-detail.entity';
import { OrderPaymentSummary } from '../merchandise/payments/order-payment-summary.entity';
import { OrderItem } from '../merchandise/orders/order-item.entity';
import { Order } from '../merchandise/orders/order.entity';
import { Story } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { User } from '../users/user.entity';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: string;
  userId?: string;
  universeId?: string;
  productId?: string;
  categoryId?: string;
  paymentMethod?: string;
  isSandbox?: boolean;
  page?: number;
  limit?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: Record<string, number | string>;
}

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  return new Date(s);
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Story) private storiesRepo: Repository<Story>,
    @InjectRepository(Universe) private universesRepo: Repository<Universe>,
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(OrderPaymentSummary) private paymentSummaryRepo: Repository<OrderPaymentSummary>,
    @InjectRepository(OrderPaymentDetail) private paymentDetailRepo: Repository<OrderPaymentDetail>,
    @InjectRepository(AiUsageLog) private aiLogsRepo: Repository<AiUsageLog>,
    @InjectRepository(StoryGenerationCost) private genCostRepo: Repository<StoryGenerationCost>,
    @InjectRepository(GenerationJob) private jobsRepo: Repository<GenerationJob>,
    @InjectRepository(Influencer) private influencersRepo: Repository<Influencer>,
    @InjectRepository(InfluencerCommission) private commissionsRepo: Repository<InfluencerCommission>,
    @InjectRepository(InfluencerCouponCode) private couponsRepo: Repository<InfluencerCouponCode>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(ProductCategory) private categoriesRepo: Repository<ProductCategory>,
    @InjectRepository(PlatformSetting) private settingsRepo: Repository<PlatformSetting>,
    private dataSource: DataSource,
  ) {}

  private async getUsdToInr(): Promise<number> {
    const row = await this.settingsRepo.findOne({ where: { key: 'USD_INR_RATE' } });
    return row ? toNum(row.value) || 96 : 96;
  }

  private defaultDateRange(filters: ReportFilters): { from: Date; to: Date } {
    const now = new Date();
    const from = filters.dateFrom
      ? startOfDay(parseDate(filters.dateFrom)!)
      : startOfDay(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
    const to = filters.dateTo
      ? endOfDay(parseDate(filters.dateTo)!)
      : endOfDay(now);
    return { from, to };
  }

  private paginate(page = 1, limit = 25): { page: number; limit: number; skip: number } {
    const p = Math.max(1, page);
    const l = [25, 50, 100].includes(limit) ? limit : 25;
    return { page: p, limit: l, skip: (p - 1) * l };
  }

  // ─── SALES & REVENUE ─────────────────────────────────────────────────────

  async getSalesRevenue(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const qb = this.dataSource.createQueryBuilder(Order, 'o')
      .leftJoin(User, 'u', 'u.id = o.userId')
      .leftJoin(OrderPaymentSummary, 'ops', 'ops.orderId = o.id')
      .leftJoin(Influencer, 'inf', 'inf.id = o.influencerId')
      .select([
        'o.id AS "id"',
        'o.orderNumber AS "orderNumber"',
        'u.name AS "userName"',
        'u.email AS "userEmail"',
        'o.createdAt AS "createdAt"',
        'o.status AS "status"',
        'ops.paymentStatus AS "paymentStatus"',
        'o.subtotalAmount AS "subtotal"',
        'o.discountAmount AS "discount"',
        'o.shippingAmount AS "shipping"',
        'o.taxAmount AS "tax"',
        'o.totalAmount AS "total"',
        'o.currency AS "currency"',
        'o.paymentMethod AS "paymentMethod"',
        'o.couponCode AS "couponCode"',
        'inf.name AS "influencerName"',
        'o.orderType AS "orderType"',
        'o.isSandbox AS "isSandbox"',
      ])
      .where('o.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('o.deletedAt IS NULL');

    if (filters.isSandbox !== undefined) {
      qb.andWhere('o.isSandbox = :sb', { sb: filters.isSandbox });
    }
    if (filters.status) qb.andWhere('o.status = :status', { status: filters.status });
    if (filters.paymentMethod) qb.andWhere('o.paymentMethod = :pm', { pm: filters.paymentMethod });
    if (filters.search) {
      qb.andWhere('(o.orderNumber ILIKE :s OR u.name ILIKE :s OR u.email ILIKE :s)', { s: `%${filters.search}%` });
    }

    qb.orderBy('o.createdAt', 'DESC');

    const total = await qb.getCount();

    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    // summary
    const summQb = this.dataSource.createQueryBuilder(Order, 'o')
      .select([
        'COALESCE(SUM(o.totalAmount), 0) AS "totalRevenue"',
        'COUNT(o.id) AS "totalOrders"',
        'COALESCE(AVG(o.totalAmount), 0) AS "avgOrderValue"',
        'COALESCE(SUM(o.discountAmount), 0) AS "totalDiscount"',
        'COALESCE(SUM(o.shippingAmount), 0) AS "totalShipping"',
        'COALESCE(SUM(ops.totalRefundedAmount), 0) AS "totalRefunded"',
      ])
      .leftJoin(OrderPaymentSummary, 'ops', 'ops.orderId = o.id')
      .where('o.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('o.deletedAt IS NULL');

    if (filters.isSandbox !== undefined) summQb.andWhere('o.isSandbox = :sb', { sb: filters.isSandbox });
    if (filters.status) summQb.andWhere('o.status = :status', { status: filters.status });

    const [summRow] = await summQb.getRawMany<Record<string, unknown>>();
    const summary = {
      totalRevenue: toNum(summRow?.totalRevenue),
      totalOrders: toNum(summRow?.totalOrders),
      avgOrderValue: Math.round(toNum(summRow?.avgOrderValue)),
      totalDiscount: toNum(summRow?.totalDiscount),
      totalShipping: toNum(summRow?.totalShipping),
      totalRefunded: toNum(summRow?.totalRefunded),
    };

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1, summary };
  }

  // ─── ORDERS ───────────────────────────────────────────────────────────────

  async getOrders(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const qb = this.dataSource.createQueryBuilder(Order, 'o')
      .leftJoin(User, 'u', 'u.id = o.userId')
      .leftJoin(OrderPaymentSummary, 'ops', 'ops.orderId = o.id')
      .select([
        'o.id AS "id"',
        'o.orderNumber AS "orderNumber"',
        'COALESCE(o.customerName, u.name) AS "customerName"',
        'COALESCE(o.customerEmail, u.email) AS "customerEmail"',
        'o.customerPhone AS "customerPhone"',
        'o.status AS "status"',
        'o.orderType AS "orderType"',
        'ops.paymentStatus AS "paymentStatus"',
        'o.totalAmount AS "total"',
        'o.currency AS "currency"',
        'o.shippingCity AS "shippingCity"',
        'o.shippingState AS "shippingState"',
        'o.trackingNumber AS "trackingNumber"',
        'o.createdAt AS "createdAt"',
        'o.updatedAt AS "updatedAt"',
        'o.isSandbox AS "isSandbox"',
      ])
      .where('o.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('o.deletedAt IS NULL');

    if (filters.isSandbox !== undefined) qb.andWhere('o.isSandbox = :sb', { sb: filters.isSandbox });
    if (filters.status) qb.andWhere('o.status = :status', { status: filters.status });
    if (filters.userId) qb.andWhere('o.userId = :uid', { uid: filters.userId });
    if (filters.search) {
      qb.andWhere('(o.orderNumber ILIKE :s OR COALESCE(o.customerName, u.name) ILIKE :s OR COALESCE(o.customerEmail, u.email) ILIKE :s)', { s: `%${filters.search}%` });
    }

    qb.orderBy('o.createdAt', 'DESC');

    const total = await qb.getCount();
    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    // status counts
    const countQb = this.dataSource.createQueryBuilder(Order, 'o')
      .select(['o.status AS "status"', 'COUNT(o.id) AS "cnt"'])
      .where('o.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('o.deletedAt IS NULL');
    if (filters.isSandbox !== undefined) countQb.andWhere('o.isSandbox = :sb', { sb: filters.isSandbox });
    countQb.groupBy('o.status');
    const counts = await countQb.getRawMany<{ status: string; cnt: string }>();
    const byStatus: Record<string, number> = {};
    counts.forEach(r => { byStatus[r.status] = toNum(r.cnt); });

    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalOrders: total,
        pendingOrders: byStatus['pending_payment'] ?? 0,
        shippedOrders: byStatus['shipped'] ?? 0,
        deliveredOrders: byStatus['delivered'] ?? 0,
        cancelledOrders: byStatus['cancelled'] ?? 0,
        failedOrders: byStatus['failed'] ?? 0,
      },
    };
  }

  // ─── MERCHANDISE ─────────────────────────────────────────────────────────

  async getMerchandise(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const qb = this.dataSource.createQueryBuilder(Product, 'p')
      .leftJoin(ProductCategory, 'pc', 'pc.id = p.categoryId')
      .leftJoin(OrderItem, 'oi', 'oi.productId = p.id AND oi.deletedAt IS NULL')
      .leftJoin(Order, 'o', 'o.id = oi.orderId AND o.deletedAt IS NULL AND o.createdAt BETWEEN :from AND :to', { from, to })
      .select([
        'p.id AS "id"',
        'p.name AS "productName"',
        'pc.name AS "category"',
        'p.productType AS "productType"',
        'p.isActive AS "isActive"',
        'COALESCE(SUM(oi.quantity), 0) AS "quantitySold"',
        'COALESCE(SUM(oi.totalPrice), 0) AS "grossRevenue"',
        'COUNT(DISTINCT oi.orderId) AS "ordersCount"',
        'p.createdAt AS "createdAt"',
      ])
      .where('p.deletedAt IS NULL')
      .groupBy('p.id, pc.name')
      .orderBy('"quantitySold"', 'DESC');

    if (filters.isSandbox !== undefined) {
      qb.andWhere('(o.isSandbox = :sb OR o.id IS NULL)', { sb: filters.isSandbox });
    }
    if (filters.categoryId) qb.andWhere('p.categoryId = :cid', { cid: filters.categoryId });
    if (filters.search) qb.andWhere('p.name ILIKE :s', { s: `%${filters.search}%` });

    const total = await qb.getCount();
    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    const summRow = items.reduce(
      (acc: { totalQuantitySold: number; totalGrossRevenue: number; physicalCount: number; digitalCount: number }, r) => ({
        totalQuantitySold: acc.totalQuantitySold + toNum(r.quantitySold),
        totalGrossRevenue: acc.totalGrossRevenue + toNum(r.grossRevenue),
        physicalCount: acc.physicalCount + (r.productType === 'physical' ? toNum(r.quantitySold) : 0),
        digitalCount: acc.digitalCount + (r.productType === 'digital' ? toNum(r.quantitySold) : 0),
      }),
      { totalQuantitySold: 0, totalGrossRevenue: 0, physicalCount: 0, digitalCount: 0 },
    );

    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        ...summRow,
        totalProducts: total,
        topProduct: (items[0] as Record<string, unknown>)?.productName as string ?? '—',
      },
    };
  }

  // ─── AI USAGE ────────────────────────────────────────────────────────────

  async getAiUsage(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);
    const usdToInr = await this.getUsdToInr();

    const qb = this.dataSource.createQueryBuilder(AiUsageLog, 'al')
      .leftJoin(User, 'u', 'u.id = al.userId')
      .leftJoin(Story, 's', 's.id = al.storyId')
      .leftJoin(Universe, 'un', 'un.id = al.universeId')
      .select([
        'al.id AS "id"',
        'al.createdAt AS "createdAt"',
        'al.provider AS "provider"',
        'al.model AS "model"',
        'al.operation AS "operation"',
        'u.name AS "userName"',
        'u.email AS "userEmail"',
        's.title AS "storyTitle"',
        'un.name AS "universeName"',
        'al.inputTokens AS "inputTokens"',
        'al.outputTokens AS "outputTokens"',
        'al.imagesGenerated AS "imagesGenerated"',
        'al.audioSeconds AS "audioSeconds"',
        'al.estimatedCostUsd AS "estimatedCostUsd"',
        `ROUND((al.estimatedCostUsd * ${usdToInr})::numeric, 2) AS "estimatedCostInr"`,
        'al.isSandbox AS "isSandbox"',
      ])
      .where('al.createdAt BETWEEN :from AND :to', { from, to });

    if (filters.isSandbox !== undefined) qb.andWhere('al.isSandbox = :sb', { sb: filters.isSandbox });
    if (filters.userId) qb.andWhere('al.userId = :uid', { uid: filters.userId });
    if (filters.universeId) qb.andWhere('al.universeId = :unid', { unid: filters.universeId });
    if (filters.status) qb.andWhere('al.operation = :op', { op: filters.status }); // status = operation filter
    if (filters.search) qb.andWhere('(al.provider ILIKE :s OR al.model ILIKE :s OR u.name ILIKE :s)', { s: `%${filters.search}%` });

    qb.orderBy('al.createdAt', 'DESC');

    const total = await qb.getCount();
    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    // summary
    const sumQb = this.dataSource.createQueryBuilder(AiUsageLog, 'al')
      .select([
        'COALESCE(SUM(al.estimatedCostUsd), 0) AS "totalCostUsd"',
        'COALESCE(SUM(al.imagesGenerated), 0) AS "totalImages"',
        'COALESCE(SUM(al.audioSeconds), 0) AS "totalAudioSeconds"',
        `COALESCE(SUM(CASE WHEN al.provider = 'openai' THEN al.estimatedCostUsd ELSE 0 END), 0) AS "openaiCost"`,
        `COALESCE(SUM(CASE WHEN al.provider = 'google' OR al.provider = 'gemini' THEN al.estimatedCostUsd ELSE 0 END), 0) AS "geminiCost"`,
      ])
      .where('al.createdAt BETWEEN :from AND :to', { from, to });
    if (filters.isSandbox !== undefined) sumQb.andWhere('al.isSandbox = :sb', { sb: filters.isSandbox });
    const [sr] = await sumQb.getRawMany<Record<string, unknown>>();

    // avg cost per story via story_generation_costs
    const avgQb = this.dataSource.createQueryBuilder(StoryGenerationCost, 'sgc')
      .select('COALESCE(AVG(sgc.totalCostUsd), 0) AS "avgCostPerStory"')
      .where('sgc.createdAt BETWEEN :from AND :to', { from, to });
    if (filters.isSandbox !== undefined) avgQb.andWhere('sgc.isSandbox = :sb', { sb: filters.isSandbox });
    const [avgRow] = await avgQb.getRawMany<Record<string, unknown>>();

    const totalCostUsd = toNum(sr?.totalCostUsd);
    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalAiCostUsd: Math.round(totalCostUsd * 1000) / 1000,
        totalAiCostInr: Math.round(totalCostUsd * usdToInr),
        openaiCostUsd: Math.round(toNum(sr?.openaiCost) * 100) / 100,
        geminiCostUsd: Math.round(toNum(sr?.geminiCost) * 100) / 100,
        avgCostPerStoryUsd: Math.round(toNum(avgRow?.avgCostPerStory) * 10000) / 10000,
        totalImagesGenerated: toNum(sr?.totalImages),
        totalNarrationMinutes: Math.round(toNum(sr?.totalAudioSeconds) / 60),
      },
    };
  }

  // ─── STORIES ─────────────────────────────────────────────────────────────

  async getStories(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const qb = this.dataSource.createQueryBuilder(Story, 's')
      .leftJoin(User, 'u', 'u.id = s.userId')
      .leftJoin(Universe, 'un', 'un.id = s.universeId')
      .leftJoin(StoryGenerationCost, 'sgc', 'sgc.storyId = s.id')
      .select([
        's.id AS "id"',
        's.title AS "title"',
        'u.name AS "userName"',
        'u.email AS "userEmail"',
        'un.name AS "universeName"',
        's.storyMode AS "storyMode"',
        's.theme AS "theme"',
        `jsonb_array_length(s.pages::jsonb) AS "pageCount"`,
        's.status AS "status"',
        's.videoStatus AS "videoStatus"',
        'sgc.totalCostUsd AS "generationCostUsd"',
        's.createdAt AS "createdAt"',
        's.isSandbox AS "isSandbox"',
      ])
      .where('s.createdAt BETWEEN :from AND :to', { from, to });

    if (filters.isSandbox !== undefined) qb.andWhere('s.isSandbox = :sb', { sb: filters.isSandbox });
    if (filters.status) qb.andWhere('s.status = :status', { status: filters.status });
    if (filters.userId) qb.andWhere('s.userId = :uid', { uid: filters.userId });
    if (filters.universeId) qb.andWhere('s.universeId = :unid', { unid: filters.universeId });
    if (filters.search) {
      qb.andWhere('(s.title ILIKE :s OR u.name ILIKE :s OR un.name ILIKE :s)', { s: `%${filters.search}%` });
    }

    qb.orderBy('s.createdAt', 'DESC');

    const total = await qb.getCount();
    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    // summary
    const sumQb = this.dataSource.createQueryBuilder(Story, 's')
      .select([
        'COUNT(s.id) AS "total"',
        `COUNT(CASE WHEN s.status = 'completed' THEN 1 END) AS "completed"`,
        `COUNT(CASE WHEN s.status = 'failed' THEN 1 END) AS "failed"`,
      ])
      .where('s.createdAt BETWEEN :from AND :to', { from, to });
    if (filters.isSandbox !== undefined) sumQb.andWhere('s.isSandbox = :sb', { sb: filters.isSandbox });
    const [sr] = await sumQb.getRawMany<Record<string, unknown>>();

    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalStories: toNum(sr?.total),
        completedStories: toNum(sr?.completed),
        failedStories: toNum(sr?.failed),
      },
    };
  }

  // ─── UNIVERSES ───────────────────────────────────────────────────────────

  async getUniverses(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const qb = this.dataSource.createQueryBuilder(Universe, 'un')
      .leftJoin(User, 'u', 'u.id = un.userId')
      .select([
        'un.id AS "id"',
        'un.name AS "universeName"',
        'u.name AS "userName"',
        'u.email AS "userEmail"',
        '(SELECT COUNT(*) FROM heroes h WHERE h.universe_id = un.id) AS "heroesCount"',
        '(SELECT COUNT(*) FROM stories st WHERE st.universe_id = un.id) AS "storiesCount"',
        '(SELECT COUNT(*) FROM hero_powers hp WHERE hp.universe_id = un.id) AS "powersCount"',
        '(SELECT COUNT(*) FROM quests q WHERE q.universe_id = un.id) AS "questsCount"',
        '(SELECT MAX(st2.created_at) FROM stories st2 WHERE st2.universe_id = un.id) AS "lastStoryDate"',
        'un.createdAt AS "createdAt"',
        'un.isSandbox AS "isSandbox"',
      ])
      .where('un.createdAt BETWEEN :from AND :to', { from, to });

    if (filters.isSandbox !== undefined) qb.andWhere('un.isSandbox = :sb', { sb: filters.isSandbox });
    if (filters.userId) qb.andWhere('un.userId = :uid', { uid: filters.userId });
    if (filters.search) qb.andWhere('(un.name ILIKE :s OR u.name ILIKE :s)', { s: `%${filters.search}%` });

    qb.orderBy('un.createdAt', 'DESC');

    const total = await qb.getCount();
    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    const sumQb = this.dataSource.createQueryBuilder(Universe, 'un')
      .select(['COUNT(un.id) AS "total"'])
      .where('un.createdAt BETWEEN :from AND :to', { from, to });
    if (filters.isSandbox !== undefined) sumQb.andWhere('un.isSandbox = :sb', { sb: filters.isSandbox });
    const [sr] = await sumQb.getRawMany<Record<string, unknown>>();

    const topUniverse = items.reduce<Record<string, unknown> | null>((top, r) => {
      if (!top || toNum(r.storiesCount) > toNum(top.storiesCount)) return r;
      return top;
    }, null);

    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalUniverses: toNum(sr?.total),
        mostActiveUniverse: (topUniverse?.universeName as string) ?? '—',
        avgStoriesPerUniverse: total > 0 ? Math.round(items.reduce((s, r) => s + toNum(r.storiesCount), 0) / items.length) : 0,
      },
    };
  }

  // ─── USERS ────────────────────────────────────────────────────────────────

  async getUsers(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const qb = this.dataSource.createQueryBuilder(User, 'u')
      .leftJoin('stories', 'st', 'st.user_id = u.id')
      .leftJoin('universes', 'un', 'un.user_id = u.id')
      .leftJoin(Order, 'o', 'o.userId = u.id AND o.deletedAt IS NULL')
      .select([
        'u.id AS "id"',
        'u.name AS "name"',
        'u.email AS "email"',
        'u.createdAt AS "createdAt"',
        'u.credits AS "creditsRemaining"',
        'u.plan AS "plan"',
        'u.isPremium AS "isPremium"',
        'COUNT(DISTINCT st.id) AS "storiesCount"',
        'COUNT(DISTINCT un.id) AS "universesCount"',
        'COUNT(DISTINCT o.id) AS "ordersCount"',
        'COALESCE(SUM(o.totalAmount), 0) AS "totalSpent"',
        'u.isSandbox AS "isSandbox"',
      ])
      .where('u.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere("u.role = 'parent'")
      .groupBy('u.id');

    if (filters.isSandbox !== undefined) qb.andWhere('u.isSandbox = :sb', { sb: filters.isSandbox });
    if (filters.search) qb.andWhere('(u.name ILIKE :s OR u.email ILIKE :s)', { s: `%${filters.search}%` });

    qb.orderBy('u.createdAt', 'DESC');

    const total = await qb.getCount();
    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    const sumQb = this.dataSource.createQueryBuilder(User, 'u')
      .select([
        'COUNT(u.id) AS "total"',
        'COUNT(CASE WHEN u.isPremium = true THEN 1 END) AS "paying"',
      ])
      .where('u.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere("u.role = 'parent'");
    if (filters.isSandbox !== undefined) sumQb.andWhere('u.isSandbox = :sb', { sb: filters.isSandbox });
    const [sr] = await sumQb.getRawMany<Record<string, unknown>>();

    const nowMonth = new Date();
    const monthStart = new Date(nowMonth.getFullYear(), nowMonth.getMonth(), 1);
    const newThisMonth = await this.usersRepo.count({
      where: { createdAt: Between(monthStart, new Date()) },
    });

    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalUsers: toNum(sr?.total),
        payingUsers: toNum(sr?.paying),
        freeUsers: toNum(sr?.total) - toNum(sr?.paying),
        newUsersThisMonth: newThisMonth,
        avgStoriesPerUser: total > 0 && items.length > 0 ? Math.round(items.reduce((s, r) => s + toNum(r.storiesCount), 0) / items.length) : 0,
      },
    };
  }

  // ─── INFLUENCERS ─────────────────────────────────────────────────────────

  async getInfluencers(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const qb = this.dataSource.createQueryBuilder(Influencer, 'inf')
      .leftJoin(InfluencerCouponCode, 'icc', 'icc.influencerId = inf.id AND icc.deletedAt IS NULL')
      .leftJoin(InfluencerCommission, 'ic', 'ic.influencerId = inf.id AND ic.deletedAt IS NULL AND ic.createdAt BETWEEN :from AND :to', { from, to })
      .select([
        'inf.id AS "id"',
        'inf.name AS "influencerName"',
        'inf.code AS "influencerCode"',
        'inf.email AS "email"',
        'inf.status AS "status"',
        'inf.commissionPct AS "commissionRate"',
        'COALESCE(MAX(icc.code), inf.code) AS "couponCode"',
        'COUNT(DISTINCT ic.id) AS "successfulOrders"',
        'COALESCE(SUM(ic.commissionableAmount), 0) AS "revenueGenerated"',
        'COALESCE(SUM(ic.discountAmount), 0) AS "discountGiven"',
        'COALESCE(SUM(ic.commissionAmount), 0) AS "commissionEarned"',
        `COALESCE(SUM(CASE WHEN ic.status = 'paid' THEN ic.commissionAmount ELSE 0 END), 0) AS "commissionPaid"`,
        `COALESCE(SUM(CASE WHEN ic.status != 'paid' THEN ic.commissionAmount ELSE 0 END), 0) AS "unpaidBalance"`,
        'inf.createdAt AS "createdAt"',
      ])
      .where('inf.deletedAt IS NULL')
      .groupBy('inf.id')
      .orderBy('"revenueGenerated"', 'DESC');

    if (filters.status) qb.andWhere('inf.status = :status', { status: filters.status });
    if (filters.search) qb.andWhere('(inf.name ILIKE :s OR inf.code ILIKE :s)', { s: `%${filters.search}%` });

    const total = await qb.getCount();
    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    const totalCommissionPayable = items.reduce((s, r) => s + toNum(r.unpaidBalance), 0);
    const totalCommissionPaid = items.reduce((s, r) => s + toNum(r.commissionPaid), 0);
    const totalRevenue = items.reduce((s, r) => s + toNum(r.revenueGenerated), 0);
    const topInfluencer = items[0]?.influencerName as string ?? '—';

    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalInfluencers: total,
        activeInfluencers: items.filter(r => r.status === 'active').length,
        revenueFromInfluencers: Math.round(totalRevenue),
        commissionPayable: Math.round(totalCommissionPayable),
        commissionPaid: Math.round(totalCommissionPaid),
        topInfluencer,
      },
    };
  }

  // ─── PAYMENTS & REFUNDS ──────────────────────────────────────────────────

  async getPaymentsRefunds(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const qb = this.dataSource.createQueryBuilder(OrderPaymentDetail, 'opd')
      .leftJoin(Order, 'o', 'o.id = opd.orderId AND o.deletedAt IS NULL')
      .leftJoin(User, 'u', 'u.id = o.userId')
      .select([
        'opd.id AS "id"',
        'o.orderNumber AS "orderNumber"',
        'u.name AS "userName"',
        'u.email AS "userEmail"',
        'opd.transactionType AS "transactionType"',
        'opd.paymentProvider AS "paymentProvider"',
        'opd.paymentMethod AS "paymentMethod"',
        'opd.amount AS "amount"',
        'opd.currency AS "currency"',
        'opd.status AS "status"',
        'opd.transactionId AS "transactionId"',
        'opd.providerReference AS "providerReference"',
        'opd.createdAt AS "createdAt"',
        'o.isSandbox AS "isSandbox"',
      ])
      .where('opd.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('opd.deletedAt IS NULL');

    if (filters.isSandbox !== undefined) qb.andWhere('o.isSandbox = :sb', { sb: filters.isSandbox });
    if (filters.status) qb.andWhere('opd.transactionType = :tt', { tt: filters.status });
    if (filters.paymentMethod) qb.andWhere('opd.paymentMethod = :pm', { pm: filters.paymentMethod });
    if (filters.search) qb.andWhere('(o.orderNumber ILIKE :s OR opd.transactionId ILIKE :s OR u.name ILIKE :s)', { s: `%${filters.search}%` });

    qb.orderBy('opd.createdAt', 'DESC');

    const total = await qb.getCount();
    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    const sumQb = this.dataSource.createQueryBuilder(OrderPaymentDetail, 'opd')
      .leftJoin(Order, 'o', 'o.id = opd.orderId AND o.deletedAt IS NULL')
      .select([
        `COALESCE(SUM(CASE WHEN opd.transactionType = 'payment' AND opd.status = 'captured' THEN opd.amount ELSE 0 END), 0) AS "totalPaid"`,
        `COALESCE(SUM(CASE WHEN opd.transactionType IN ('refund', 'partial_refund') THEN opd.amount ELSE 0 END), 0) AS "totalRefunded"`,
        `COUNT(CASE WHEN opd.status = 'failed' THEN 1 END) AS "failedPayments"`,
      ])
      .where('opd.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('opd.deletedAt IS NULL');
    if (filters.isSandbox !== undefined) sumQb.andWhere('o.isSandbox = :sb', { sb: filters.isSandbox });
    const [sr] = await sumQb.getRawMany<Record<string, unknown>>();

    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalPaid: toNum(sr?.totalPaid),
        totalRefunded: toNum(sr?.totalRefunded),
        netCollected: toNum(sr?.totalPaid) - toNum(sr?.totalRefunded),
        failedPayments: toNum(sr?.failedPayments),
      },
    };
  }

  // ─── GENERATION JOBS ─────────────────────────────────────────────────────

  async getGenerationJobs(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const qb = this.dataSource.createQueryBuilder(GenerationJob, 'gj')
      .leftJoin(User, 'u', 'u.id = gj.userId')
      .leftJoin(Story, 's', 's.id = gj.storyId')
      .leftJoin(Universe, 'un', 'un.id = gj.universeId')
      .select([
        'gj.id AS "id"',
        'u.name AS "userName"',
        'u.email AS "userEmail"',
        's.title AS "storyTitle"',
        'un.name AS "universeName"',
        'gj.status AS "status"',
        'gj.currentStep AS "currentStep"',
        'gj.progressPercentage AS "progressPct"',
        'gj.startedAt AS "startedAt"',
        'gj.completedAt AS "completedAt"',
        `EXTRACT(EPOCH FROM (COALESCE(gj.completedAt, NOW()) - gj.startedAt))::int AS "durationSeconds"`,
        'gj.errorMessage AS "errorMessage"',
        'gj.createdAt AS "createdAt"',
      ])
      .where('gj.createdAt BETWEEN :from AND :to', { from, to });

    if (filters.status) qb.andWhere('gj.status = :status', { status: filters.status });
    if (filters.userId) qb.andWhere('gj.userId = :uid', { uid: filters.userId });
    if (filters.search) qb.andWhere('(u.name ILIKE :s OR s.title ILIKE :s)', { s: `%${filters.search}%` });

    qb.orderBy('gj.createdAt', 'DESC');

    const total = await qb.getCount();
    if (!exportAll) qb.offset(skip).limit(limit);
    const items = await qb.getRawMany<Record<string, unknown>>();

    const sumQb = this.dataSource.createQueryBuilder(GenerationJob, 'gj')
      .select([
        'COUNT(gj.id) AS "total"',
        `COUNT(CASE WHEN gj.status = 'completed' THEN 1 END) AS "completed"`,
        `COUNT(CASE WHEN gj.status = 'failed' THEN 1 END) AS "failed"`,
        `COUNT(CASE WHEN gj.status NOT IN ('completed', 'failed') THEN 1 END) AS "running"`,
        `COALESCE(AVG(EXTRACT(EPOCH FROM (gj.completedAt - gj.startedAt))), 0) AS "avgDuration"`,
      ])
      .where('gj.createdAt BETWEEN :from AND :to', { from, to });
    if (filters.status) sumQb.andWhere('gj.status = :status', { status: filters.status });
    const [sr] = await sumQb.getRawMany<Record<string, unknown>>();

    const tot = toNum(sr?.total);
    const failed = toNum(sr?.failed);
    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalJobs: tot,
        completedJobs: toNum(sr?.completed),
        failedJobs: failed,
        runningJobs: toNum(sr?.running),
        avgDurationSeconds: Math.round(toNum(sr?.avgDuration)),
        failureRate: tot > 0 ? Math.round((failed / tot) * 100) : 0,
      },
    };
  }

  // ─── PROFITABILITY ───────────────────────────────────────────────────────

  async getProfitability(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);
    const usdToInr = await this.getUsdToInr();
    const sbVal = filters.isSandbox;

    // Separate simple queries — avoid complex CTE with generate_series
    const [revRows, aiRows, commRows, refundRows] = await Promise.all([
      this.dataSource.query<{ day: string; revenue: string; discounts: string }[]>(
        `SELECT DATE(created_at)::text AS day,
                COALESCE(SUM(total_amount),0)::float AS revenue,
                COALESCE(SUM(discount_amount),0)::float AS discounts
         FROM orders
         WHERE deleted_at IS NULL AND created_at BETWEEN $1 AND $2
           ${sbVal !== undefined ? `AND is_sandbox = ${sbVal}` : ''}
         GROUP BY DATE(created_at)`,
        [from, to],
      ),
      this.dataSource.query<{ day: string; ai_cost: string }[]>(
        `SELECT DATE(created_at)::text AS day,
                COALESCE(SUM(estimated_cost_usd * $3),0)::float AS ai_cost
         FROM ai_usage_logs
         WHERE created_at BETWEEN $1 AND $2
           ${sbVal !== undefined ? `AND is_sandbox = ${sbVal}` : ''}
         GROUP BY DATE(created_at)`,
        [from, to, usdToInr],
      ),
      this.dataSource.query<{ day: string; commission: string }[]>(
        `SELECT DATE(created_at)::text AS day,
                COALESCE(SUM(commission_amount),0)::float AS commission
         FROM influencer_commissions
         WHERE deleted_at IS NULL AND created_at BETWEEN $1 AND $2
         GROUP BY DATE(created_at)`,
        [from, to],
      ),
      this.dataSource.query<{ day: string; refunds: string }[]>(
        `SELECT DATE(created_at)::text AS day,
                COALESCE(SUM(total_refunded_amount),0)::float AS refunds
         FROM order_payment_summaries
         WHERE deleted_at IS NULL AND created_at BETWEEN $1 AND $2
         GROUP BY DATE(created_at)`,
        [from, to],
      ),
    ]);

    // Merge by day
    const dayMap = new Map<string, { revenue: number; aiCostInr: number; influencerCommission: number; refunds: number }>();
    const ensureDay = (d: string) => {
      if (!dayMap.has(d)) dayMap.set(d, { revenue: 0, aiCostInr: 0, influencerCommission: 0, refunds: 0 });
      return dayMap.get(d)!;
    };
    revRows.forEach(r => { ensureDay(r.day).revenue = toNum(r.revenue); });
    aiRows.forEach(r => { ensureDay(r.day).aiCostInr = toNum(r.ai_cost); });
    commRows.forEach(r => { ensureDay(r.day).influencerCommission = toNum(r.commission); });
    refundRows.forEach(r => { ensureDay(r.day).refunds = toNum(r.refunds); });

    const allRows = Array.from(dayMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, d]) => {
        const profit = d.revenue - d.aiCostInr - d.influencerCommission - d.refunds;
        return {
          date,
          revenue: Math.round(d.revenue * 100) / 100,
          aiCostInr: Math.round(d.aiCostInr * 100) / 100,
          influencerCommission: Math.round(d.influencerCommission * 100) / 100,
          refunds: Math.round(d.refunds * 100) / 100,
          estimatedGrossProfit: Math.round(profit * 100) / 100,
          estimatedMarginPct: d.revenue > 0 ? Math.round((profit / d.revenue) * 100) : 0,
        };
      });

    const total = allRows.length;
    const enriched = exportAll ? allRows : allRows.slice(skip, skip + limit);

    const totalRevenue = allRows.reduce((s, r) => s + r.revenue, 0);
    const totalAiCost = allRows.reduce((s, r) => s + r.aiCostInr, 0);
    const totalCommission = allRows.reduce((s, r) => s + r.influencerCommission, 0);
    const totalRefunds = allRows.reduce((s, r) => s + r.refunds, 0);
    const totalProfit = totalRevenue - totalAiCost - totalCommission - totalRefunds;

    return {
      items: enriched as unknown as Record<string, unknown>[], total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalRevenue: Math.round(totalRevenue),
        totalAiCostInr: Math.round(totalAiCost),
        totalInfluencerCommission: Math.round(totalCommission),
        totalRefunds: Math.round(totalRefunds),
        estimatedGrossProfit: Math.round(totalProfit),
        estimatedMarginPct: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
      },
    };
  }

  // ─── DISPATCH ─────────────────────────────────────────────────────────────

  async getReport(reportType: string, filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    switch (reportType) {
      case 'sales-revenue':      return this.getSalesRevenue(filters, exportAll);
      case 'orders':             return this.getOrders(filters, exportAll);
      case 'merchandise':        return this.getMerchandise(filters, exportAll);
      case 'ai-usage':           return this.getAiUsage(filters, exportAll);
      case 'stories':            return this.getStories(filters, exportAll);
      case 'universes':          return this.getUniverses(filters, exportAll);
      case 'users':              return this.getUsers(filters, exportAll);
      case 'influencers':        return this.getInfluencers(filters, exportAll);
      case 'payments-refunds':   return this.getPaymentsRefunds(filters, exportAll);
      case 'generation-jobs':    return this.getGenerationJobs(filters, exportAll);
      case 'profitability':      return this.getProfitability(filters, exportAll);
      default:                   return this.getOrders(filters, exportAll);
    }
  }
}

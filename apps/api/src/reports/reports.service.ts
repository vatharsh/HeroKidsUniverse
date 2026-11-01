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

/** Report dates are India days: "2026-10-25" means 00:00–23:59 IST. */
function istStart(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T00:00:00+05:30`);
}

function istEnd(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T23:59:59.999+05:30`);
}

function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Orders that actually brought money in (refunded ones count here; their refunds are subtracted separately). */
const COUNTED_ORDER = `o.status NOT IN ('pending_payment', 'cancelled', 'failed')`;

/** Test data at user level: pre-launch (sandbox) accounts and accounts marked as test. */
function userSandboxSql(alias: string, sandbox: boolean | undefined): string {
  if (sandbox === undefined) return 'TRUE';
  const test = `(${alias}."isSandbox" OR ${alias}."isTestAccount")`;
  return sandbox ? test : `NOT ${test}`;
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
    const today = istToday();
    const from = istStart(filters.dateFrom || new Date(istStart(today).getTime() - 89 * 86_400_000 + 5.5 * 3600_000).toISOString());
    const to = istEnd(filters.dateTo || today);
    return { from, to };
  }

  private async gstRate(): Promise<number> {
    const row = await this.settingsRepo.findOne({ where: { key: 'GST_RATE_PCT' } });
    return toNum(row?.value) || 18;
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

    // Summary: paid orders only (cancelled / failed / unpaid never brought money in), net of refunds and GST.
    const rate = await this.gstRate();
    const params: unknown[] = [from, to, rate];
    const where: string[] = [`o."deletedAt" IS NULL`, `o."createdAt" BETWEEN $1 AND $2`, COUNTED_ORDER];
    if (filters.isSandbox !== undefined) where.push(`o."isSandbox" = ${filters.isSandbox ? 'TRUE' : 'FALSE'}`);
    if (filters.status) { params.push(filters.status); where.push(`o.status = $${params.length}`); }
    if (filters.paymentMethod) { params.push(filters.paymentMethod); where.push(`o."paymentMethod" = $${params.length}`); }
    if (filters.search) { params.push(`%${filters.search}%`); where.push(`(o."orderNumber" ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
    const [sr] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS "paidOrders",
              COALESCE(SUM(o."totalAmount"), 0)::float AS gross,
              COALESCE(AVG(o."totalAmount"), 0)::float AS avg,
              COALESCE(SUM(o."discountAmount"), 0)::float AS discount,
              -- Credit packs are priced GST-inclusive; merchandise adds GST on top in taxAmount.
              COALESCE(SUM(CASE WHEN o."orderType" = 'credit_purchase'
                                THEN COALESCE(NULLIF(o."taxAmount", 0), o."totalAmount" * $3 / (100 + $3))
                                ELSE o."taxAmount" END), 0)::float AS gst,
              COALESCE(SUM(ops."totalRefundedAmount"), 0)::float AS "merchRefunds"
         FROM orders o LEFT JOIN users u ON u.id = o."userId" LEFT JOIN order_payment_summaries ops ON ops."orderId" = o.id
        WHERE ${where.join(' AND ')}`,
      params,
    );
    const [rr] = await this.dataSource.query(
      `SELECT COALESCE(SUM(t."pricePaid"), 0)::float AS refunds
         FROM credit_transactions t JOIN users u ON u.id = t."userId"
        WHERE t.reason = 'payment_refund' AND t."createdAt" BETWEEN $1 AND $2 AND ${userSandboxSql('u', filters.isSandbox)}`,
      [from, to],
    );
    const refunds = toNum(rr?.refunds) + toNum(sr?.merchRefunds);
    const gst = toNum(sr?.gst);
    const refundGst = toNum(rr?.refunds) * rate / (100 + rate);
    const summary = {
      paidOrders: toNum(sr?.paidOrders),
      grossSales: Math.round(toNum(sr?.gross)),
      refunded: Math.round(refunds),
      gstIncluded: Math.round(gst - refundGst),
      netSalesExGst: Math.round(toNum(sr?.gross) - refunds - (gst - refundGst)),
      avgOrderValue: Math.round(toNum(sr?.avg)),
      couponDiscounts: Math.round(toNum(sr?.discount)),
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
        paidOrders: Object.entries(byStatus).filter(([st]) => !['pending_payment', 'cancelled', 'failed'].includes(st)).reduce((t, [, c]) => t + c, 0),
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
      .leftJoin(Order, 'o', `o.id = oi.orderId AND o.deletedAt IS NULL AND o.createdAt BETWEEN :from AND :to AND ${COUNTED_ORDER}`, { from, to })
      .select([
        'p.id AS "id"',
        'p.name AS "productName"',
        'pc.name AS "category"',
        'p.productType AS "productType"',
        'p.isActive AS "isActive"',
        'COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity END), 0) AS "quantitySold"',
        'COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.totalPrice END), 0) AS "grossRevenue"',
        'COUNT(DISTINCT o.id) AS "ordersCount"',
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
    const params: unknown[] = [from, to];
    const where = [`un."createdAt" BETWEEN $1 AND $2`];
    if (filters.isSandbox !== undefined) where.push(`un."isSandbox" = ${filters.isSandbox ? 'TRUE' : 'FALSE'}`);
    if (filters.userId) { params.push(filters.userId); where.push(`un."userId" = $${params.length}`); }
    if (filters.search) { params.push(`%${filters.search}%`); where.push(`(un.name ILIKE $${params.length} OR u.name ILIKE $${params.length})`); }
    const base = `FROM universes un LEFT JOIN users u ON u.id = un."userId" WHERE ${where.join(' AND ')}`;

    const [{ n }] = await this.dataSource.query(`SELECT COUNT(*)::int AS n ${base}`, params);
    const items = await this.dataSource.query(
      `SELECT un.id AS "id", un.name AS "universeName", u.name AS "userName", u.email AS "userEmail",
              (SELECT COUNT(*) FROM heroes h WHERE h."universeId" = un.id)::int AS "heroesCount",
              (SELECT COUNT(*) FROM stories st WHERE st."universeId" = un.id)::int AS "storiesCount",
              (SELECT COUNT(*) FROM hero_powers hp WHERE hp."universeId" = un.id)::int AS "powersCount",
              (SELECT COUNT(*) FROM quests q WHERE q."universeId" = un.id)::int AS "questsCount",
              (SELECT MAX(st2."createdAt") FROM stories st2 WHERE st2."universeId" = un.id) AS "lastStoryDate",
              un."createdAt" AS "createdAt", un."isSandbox" AS "isSandbox"
         ${base} ORDER BY un."createdAt" DESC ${exportAll ? '' : `LIMIT ${limit} OFFSET ${skip}`}`,
      params,
    );
    const [agg] = await this.dataSource.query(
      `SELECT COALESCE(AVG(c), 0)::float AS avg, (ARRAY_AGG(name ORDER BY c DESC))[1] AS top
         FROM (SELECT un.name, (SELECT COUNT(*) FROM stories st WHERE st."universeId" = un.id) AS c ${base}) x`,
      params,
    );
    return {
      items, total: n, page, limit, totalPages: Math.ceil(n / limit) || 1,
      summary: {
        totalUniverses: n,
        mostActiveUniverse: agg?.top ?? '—',
        avgStoriesPerUniverse: Math.round(toNum(agg?.avg) * 10) / 10,
      },
    };
  }

  // ─── USERS ────────────────────────────────────────────────────────────────

  async getUsers(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);
    const params: unknown[] = [from, to];
    const where = [`u."createdAt" BETWEEN $1 AND $2`, `u.role = 'parent'`, `u."deletedAt" IS NULL`, userSandboxSql('u', filters.isSandbox)];
    if (filters.search) { params.push(`%${filters.search}%`); where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
    const base = `FROM users u WHERE ${where.join(' AND ')}`;

    const [{ n }] = await this.dataSource.query(`SELECT COUNT(*)::int AS n ${base}`, params);
    const items = await this.dataSource.query(
      `SELECT u.id AS "id", u.name AS "name", u.email AS "email", u."createdAt" AS "createdAt",
              u.credits AS "creditsRemaining", u."previewCredits" AS "freeStoryLeft",
              (SELECT COUNT(*) FROM stories st WHERE st."userId" = u.id)::int AS "storiesCount",
              (SELECT COUNT(*) FROM universes un WHERE un."userId" = u.id)::int AS "universesCount",
              (SELECT COUNT(*) FROM orders o WHERE o."userId" = u.id AND o."deletedAt" IS NULL AND ${COUNTED_ORDER})::int AS "ordersCount",
              (SELECT COALESCE(SUM(o."totalAmount"), 0) FROM orders o WHERE o."userId" = u.id AND o."deletedAt" IS NULL AND ${COUNTED_ORDER})::float AS "totalSpent",
              (u."isSandbox" OR u."isTestAccount") AS "isTest"
         ${base} ORDER BY u."createdAt" DESC ${exportAll ? '' : `LIMIT ${limit} OFFSET ${skip}`}`,
      params,
    );
    const [agg] = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM credit_transactions t WHERE t."userId" = u.id AND t.reason = 'purchase' AND t."pricePaid" > 0))::int AS paying,
              COUNT(*) FILTER (WHERE u."createdAt" >= (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'))::int AS "thisMonth",
              COALESCE(AVG((SELECT COUNT(*) FROM stories st WHERE st."userId" = u.id)), 0)::float AS "avgStories"
         ${base}`,
      params,
    );
    const paying = toNum(agg?.paying);
    return {
      items, total: n, page, limit, totalPages: Math.ceil(n / limit) || 1,
      summary: {
        totalUsers: n,
        payingUsers: paying,
        freeUsers: n - paying,
        payingSharePct: n ? Math.round((paying / n) * 1000) / 10 : 0,
        newUsersThisMonth: toNum(agg?.thisMonth),
        avgStoriesPerUser: Math.round(toNum(agg?.avgStories) * 10) / 10,
      },
    };
  }

  // ─── INFLUENCERS ─────────────────────────────────────────────────────────

  async getInfluencers(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);
    // Cancelled commissions (refunded / cancelled orders) are left out of every figure.
    const params: unknown[] = [from, to];
    const where = [`inf."deletedAt" IS NULL`];
    if (filters.status) { params.push(filters.status); where.push(`inf.status = $${params.length}`); }
    if (filters.search) { params.push(`%${filters.search}%`); where.push(`(inf.name ILIKE $${params.length} OR inf.code ILIKE $${params.length})`); }
    const commJoin = `LEFT JOIN influencer_commissions ic ON ic."influencerId" = inf.id AND ic."deletedAt" IS NULL
                        AND ic.status <> 'cancelled' AND ic."createdAt" BETWEEN $1 AND $2
                        AND EXISTS (SELECT 1 FROM users u WHERE u.id = ic."userId" AND ${userSandboxSql('u', filters.isSandbox)})`;
    const rows = await this.dataSource.query(
      `SELECT inf.id AS "id", inf.name AS "influencerName", inf.code AS "influencerCode", inf.email AS "email",
              inf.status AS "status", inf."commissionPct" AS "commissionRate",
              COALESCE((SELECT MAX(c.code) FROM influencer_coupon_codes c WHERE c."influencerId" = inf.id AND c."deletedAt" IS NULL), inf.code) AS "couponCode",
              COUNT(ic.id)::int AS "successfulOrders",
              COALESCE(SUM(ic."orderTotal"), 0)::float AS "salesPaid",
              COALESCE(SUM(ic."commissionableAmount"), 0)::float AS "salesPreGst",
              COALESCE(SUM(ic."discountAmount"), 0)::float AS "discountGiven",
              COALESCE(SUM(ic."commissionAmount"), 0)::float AS "commissionEarned",
              COALESCE(SUM(CASE WHEN ic.status = 'paid' THEN ic."commissionAmount" ELSE 0 END), 0)::float AS "commissionPaid",
              COALESCE(SUM(CASE WHEN ic.status <> 'paid' THEN ic."commissionAmount" ELSE 0 END), 0)::float AS "unpaidBalance",
              inf."createdAt" AS "createdAt"
         FROM influencers inf ${commJoin}
        WHERE ${where.join(' AND ')}
        GROUP BY inf.id ORDER BY "salesPaid" DESC`,
      params,
    );
    const total = rows.length;
    const items = exportAll ? rows : rows.slice(skip, skip + limit);
    const sum = (k: string) => rows.reduce((t: number, r: Record<string, unknown>) => t + toNum(r[k]), 0);
    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalInfluencers: total,
        activeInfluencers: rows.filter((r: Record<string, unknown>) => r.status === 'active').length,
        influencerSales: Math.round(sum('salesPaid')),
        commissionPayable: Math.round(sum('unpaidBalance')),
        commissionPaid: Math.round(sum('commissionPaid')),
        topInfluencer: rows.find((r: Record<string, unknown>) => toNum(r.salesPaid) > 0)?.influencerName ?? '—',
      },
    };
  }

  // ─── PAYMENTS & REFUNDS ──────────────────────────────────────────────────

  async getPaymentsRefunds(filters: ReportFilters, exportAll = false): Promise<PagedResult<Record<string, unknown>>> {
    const { from, to } = this.defaultDateRange(filters);
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);
    // Credit packs are paid and refunded through Razorpay directly (credit_transactions);
    // merchandise uses order_payment_details. Both are shown together.
    const ledger = `
      SELECT t.id::text AS "id",
             (SELECT o."orderNumber" FROM orders o WHERE o."orderType" = 'credit_purchase' AND o."adminNotes" LIKE '%' || t."razorpayPaymentId" || '%' LIMIT 1) AS "orderNumber",
             u.name AS "userName", u.email AS "userEmail",
             CASE WHEN t.reason = 'purchase' THEN 'payment' ELSE 'refund' END AS "transactionType",
             CASE WHEN t."razorpayPaymentId" LIKE 'pay\_%' THEN 'razorpay' ELSE 'test' END AS "paymentProvider",
             NULL::text AS "paymentMethod",
             t."pricePaid"::float AS "amount", 'INR' AS "currency", 'success' AS "status",
             CASE WHEN t.reason = 'purchase' THEN t."razorpayPaymentId" ELSE t."referenceId" END AS "transactionId",
             t."packName" AS "providerReference", t."createdAt" AS "createdAt",
             (u."isSandbox" OR u."isTestAccount") AS "isSandbox"
        FROM credit_transactions t JOIN users u ON u.id = t."userId"
       WHERE t."pricePaid" > 0 AND (t.reason = 'purchase' OR t.reason = 'payment_refund')
         AND t."createdAt" BETWEEN $1 AND $2 AND ${userSandboxSql('u', filters.isSandbox)}
      UNION ALL
      SELECT opd.id::text, o."orderNumber"::text, u.name::text, u.email::text,
             CASE WHEN opd."transactionType"::text IN ('refund', 'partial_refund') THEN 'refund' ELSE opd."transactionType"::text END,
             opd."paymentProvider"::text, opd."paymentMethod"::text, opd.amount::float, opd.currency::text, opd.status::text,
             opd."transactionId"::text, opd."providerReference"::text, opd."createdAt", o."isSandbox"
        FROM order_payment_details opd
        LEFT JOIN orders o ON o.id = opd."orderId" AND o."deletedAt" IS NULL
        LEFT JOIN users u ON u.id = o."userId"
       WHERE opd."deletedAt" IS NULL AND opd."createdAt" BETWEEN $1 AND $2
         ${filters.isSandbox !== undefined ? `AND o."isSandbox" = ${filters.isSandbox ? 'TRUE' : 'FALSE'}` : ''}`;
    const params: unknown[] = [from, to];
    const outer: string[] = ['TRUE'];
    if (filters.status) { params.push(filters.status === 'partial_refund' ? 'refund' : filters.status); outer.push(`x."transactionType" = $${params.length}`); }
    if (filters.paymentMethod) { params.push(filters.paymentMethod); outer.push(`x."paymentMethod" = $${params.length}`); }
    if (filters.search) { params.push(`%${filters.search}%`); outer.push(`(x."orderNumber" ILIKE $${params.length} OR x."transactionId" ILIKE $${params.length} OR x."userName" ILIKE $${params.length} OR x."userEmail" ILIKE $${params.length})`); }
    const base = `FROM (${ledger}) x WHERE ${outer.join(' AND ')}`;

    const [sr] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS n,
              COALESCE(SUM(CASE WHEN x."transactionType" = 'payment' AND x.status IN ('success', 'captured') THEN x.amount END), 0)::float AS paid,
              COALESCE(SUM(CASE WHEN x."transactionType" = 'refund' AND x.status IN ('success', 'captured', 'processed') THEN x.amount END), 0)::float AS refunded,
              COUNT(*) FILTER (WHERE x.status = 'failed')::int AS failed
         ${base}`,
      params,
    );
    const items = await this.dataSource.query(
      `SELECT x.* ${base} ORDER BY x."createdAt" DESC ${exportAll ? '' : `LIMIT ${limit} OFFSET ${skip}`}`,
      params,
    );
    const total = toNum(sr?.n);
    return {
      items, total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalPaid: Math.round(toNum(sr?.paid)),
        totalRefunded: Math.round(toNum(sr?.refunded)),
        netCollected: Math.round(toNum(sr?.paid) - toNum(sr?.refunded)),
        failedPayments: toNum(sr?.failed),
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

    if (filters.isSandbox !== undefined) qb.andWhere('s.isSandbox = :sb', { sb: filters.isSandbox });
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
      .leftJoin(Story, 's', 's.id = gj.storyId')
      .where('gj.createdAt BETWEEN :from AND :to', { from, to });
    if (filters.isSandbox !== undefined) sumQb.andWhere('s.isSandbox = :sb', { sb: filters.isSandbox });
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
    const rate = await this.gstRate();
    const feePct = 2.36; // Razorpay ~2% + 18% GST on the fee — an estimate
    const sb = filters.isSandbox;
    const day = (col: string) => `to_char(${col} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`;

    const [revRows, aiRows, commRows, refundRows] = await Promise.all([
      this.dataSource.query(
        `SELECT ${day('o."createdAt"')} AS day,
                COALESCE(SUM(o."totalAmount"), 0)::float AS revenue,
                COALESCE(SUM(CASE WHEN o."orderType" = 'credit_purchase'
                                  THEN COALESCE(NULLIF(o."taxAmount", 0), o."totalAmount" * $3 / (100 + $3))
                                  ELSE o."taxAmount" END), 0)::float AS gst
           FROM orders o
          WHERE o."deletedAt" IS NULL AND ${COUNTED_ORDER} AND o."createdAt" BETWEEN $1 AND $2
            ${sb !== undefined ? `AND o."isSandbox" = ${sb ? 'TRUE' : 'FALSE'}` : ''}
          GROUP BY 1`,
        [from, to, rate],
      ),
      this.dataSource.query(
        `SELECT ${day('"createdAt"')} AS day, COALESCE(SUM("estimatedCostUsd" * $3), 0)::float AS ai
           FROM ai_usage_logs
          WHERE "createdAt" BETWEEN $1 AND $2 ${sb !== undefined ? `AND "isSandbox" = ${sb ? 'TRUE' : 'FALSE'}` : ''}
          GROUP BY 1`,
        [from, to, usdToInr],
      ),
      this.dataSource.query(
        `SELECT ${day('ic."createdAt"')} AS day, COALESCE(SUM(ic."commissionAmount"), 0)::float AS commission
           FROM influencer_commissions ic JOIN users u ON u.id = ic."userId"
          WHERE ic."deletedAt" IS NULL AND ic.status <> 'cancelled' AND ic."createdAt" BETWEEN $1 AND $2
            AND ${userSandboxSql('u', sb)}
          GROUP BY 1`,
        [from, to],
      ),
      this.dataSource.query(
        `SELECT ${day('t."createdAt"')} AS day, COALESCE(SUM(t."pricePaid"), 0)::float AS refunds
           FROM credit_transactions t JOIN users u ON u.id = t."userId"
          WHERE t.reason = 'payment_refund' AND t."createdAt" BETWEEN $1 AND $2 AND ${userSandboxSql('u', sb)}
          GROUP BY 1`,
        [from, to],
      ),
    ]);

    type Day = { revenue: number; gst: number; refunds: number; ai: number; commission: number };
    const days = new Map<string, Day>();
    const at = (d: string) => days.get(d) ?? days.set(d, { revenue: 0, gst: 0, refunds: 0, ai: 0, commission: 0 }).get(d)!;
    revRows.forEach((r: Record<string, unknown>) => { const d = at(String(r.day)); d.revenue = toNum(r.revenue); d.gst = toNum(r.gst); });
    aiRows.forEach((r: Record<string, unknown>) => { at(String(r.day)).ai = toNum(r.ai); });
    commRows.forEach((r: Record<string, unknown>) => { at(String(r.day)).commission = toNum(r.commission); });
    refundRows.forEach((r: Record<string, unknown>) => { at(String(r.day)).refunds = toNum(r.refunds); });

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const allRows = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, d]) => {
      // Refunds give back the GST inside them too, so GST owed = GST on sales − GST on refunds.
      const gst = d.gst - d.refunds * rate / (100 + rate);
      const fees = d.revenue * feePct / 100;
      const profit = d.revenue - d.refunds - gst - fees - d.ai - d.commission;
      return {
        date,
        revenue: r2(d.revenue),
        refunds: r2(d.refunds),
        gst: r2(gst),
        paymentFees: r2(fees),
        aiCostInr: r2(d.ai),
        influencerCommission: r2(d.commission),
        estimatedGrossProfit: r2(profit),
        estimatedMarginPct: d.revenue > 0 ? Math.round((profit / d.revenue) * 100) : 0,
      };
    });
    const total = allRows.length;
    const sum = (k: keyof (typeof allRows)[number]) => allRows.reduce((t, r) => t + Number(r[k]), 0);
    const revenue = sum('revenue');
    const profit = sum('estimatedGrossProfit');
    return {
      items: (exportAll ? allRows : allRows.slice(skip, skip + limit)) as unknown as Record<string, unknown>[],
      total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalRevenue: Math.round(revenue),
        totalRefunds: Math.round(sum('refunds')),
        gstPayable: Math.round(sum('gst')),
        paymentFeesEst: Math.round(sum('paymentFees')),
        totalAiCostInr: Math.round(sum('aiCostInr')),
        totalInfluencerCommission: Math.round(sum('influencerCommission')),
        estimatedGrossProfit: Math.round(profit),
        estimatedMarginPct: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
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

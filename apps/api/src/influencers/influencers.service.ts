import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  DataSource,
  ILike,
  In,
  IsNull,
  MoreThanOrEqual,
  LessThanOrEqual,
  Repository,
} from 'typeorm';

import { Order } from '../merchandise/orders/order.entity';
import { User, UserRole } from '../users/user.entity';
import { CouponUsageRecord } from './coupon-usage-record.entity';
import { InfluencerCommission, CommissionStatus } from './influencer-commission.entity';
import { InfluencerCommissionRule } from './influencer-commission-rule.entity';
import { InfluencerCouponCode, CouponDiscountType, CouponType } from './influencer-coupon-code.entity';
import { InfluencerPayoutCommission } from './influencer-payout-commission.entity';
import { InfluencerPayout, PayoutStatus } from './influencer-payout.entity';
import { InfluencerWallet } from './influencer-wallet.entity';
import { Influencer, InfluencerStatus } from './influencer.entity';

export interface CouponValidationResult {
  valid: boolean;
  errorMessage?: string;
  couponCodeId?: string;
  influencerId?: string;
  couponType?: CouponType;
  discountType?: CouponDiscountType;
  discountValue?: number;
  maxDiscountAmount?: number | null;
  minimumOrderAmount?: number | null;
  appliesToProductIds?: string[] | null;
  appliesToCategoryIds?: string[] | null;
  code?: string;
  warningMessage?: string;
  perUserUsageLimit?: number | null;
}

export interface SettlePayoutDto {
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
  paymentProofUrl?: string;
  paymentProofFileType?: string;
  adminNote?: string;
}

export interface CommissionRuleInput {
  minSuccessfulOrders: number;
  commissionRate: number;
}

export interface InfluencerLoginInput {
  email: string;
  password: string;
}

export interface CreateCommissionParams {
  influencerId: string;
  couponCodeId: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  subtotalAmount: number;
  orderTotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
}

@Injectable()
export class InfluencersService implements OnModuleInit {
  constructor(
    @InjectRepository(Influencer)
    private readonly influencersRepo: Repository<Influencer>,
    @InjectRepository(InfluencerCouponCode)
    private readonly couponCodesRepo: Repository<InfluencerCouponCode>,
    @InjectRepository(InfluencerCommissionRule)
    private readonly commissionRulesRepo: Repository<InfluencerCommissionRule>,
    @InjectRepository(InfluencerCommission)
    private readonly commissionsRepo: Repository<InfluencerCommission>,
    @InjectRepository(InfluencerWallet)
    private readonly walletsRepo: Repository<InfluencerWallet>,
    @InjectRepository(InfluencerPayout)
    private readonly payoutsRepo: Repository<InfluencerPayout>,
    @InjectRepository(InfluencerPayoutCommission)
    private readonly payoutCommissionsRepo: Repository<InfluencerPayoutCommission>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(CouponUsageRecord)
    private readonly couponUsageRepo: Repository<CouponUsageRecord>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.commissionRulesRepo.count({
      where: { influencerId: IsNull(), isDeleted: false },
    });
    if (count > 0) return;

    await this.commissionRulesRepo.save([
      this.commissionRulesRepo.create({ influencerId: null, minSuccessfulOrders: 0, commissionRate: 10, isActive: true }),
      this.commissionRulesRepo.create({ influencerId: null, minSuccessfulOrders: 100, commissionRate: 12, isActive: true }),
      this.commissionRulesRepo.create({ influencerId: null, minSuccessfulOrders: 200, commissionRate: 15, isActive: true }),
      this.commissionRulesRepo.create({ influencerId: null, minSuccessfulOrders: 500, commissionRate: 20, isActive: true }),
    ]);
  }

  async validateCoupon(
    code: string,
    context?: { subtotalAmount?: number; productIds?: string[]; categoryIds?: string[]; userId?: string },
  ): Promise<CouponValidationResult> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return { valid: false, errorMessage: 'Coupon code not found' };
    }

    const coupon = await this.couponCodesRepo.findOne({
      where: { code: ILike(normalizedCode), isDeleted: false },
    });
    if (!coupon) return { valid: false, errorMessage: 'Coupon code not found' };
    if (!coupon.isActive) return { valid: false, errorMessage: 'Coupon code is not active' };

    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { valid: false, errorMessage: 'Coupon code has expired' };
    }
    if (coupon.startsAt && coupon.startsAt > now) {
      return { valid: false, errorMessage: 'Coupon code is not yet active' };
    }
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, errorMessage: 'Coupon usage limit reached' };
    }
    if (context?.subtotalAmount !== undefined && coupon.minimumOrderAmount !== null && context.subtotalAmount < Number(coupon.minimumOrderAmount)) {
      return { valid: false, errorMessage: `Minimum order amount is ₹${Number(coupon.minimumOrderAmount)}` };
    }
    if (coupon.appliesToProductIds?.length && context?.productIds?.length) {
      const matchesProduct = context.productIds.some((productId) => coupon.appliesToProductIds?.includes(productId));
      if (!matchesProduct) return { valid: false, errorMessage: 'Coupon does not apply to selected products' };
    }
    if (coupon.appliesToCategoryIds?.length && context?.categoryIds?.length) {
      const matchesCategory = context.categoryIds.some((categoryId) => coupon.appliesToCategoryIds?.includes(categoryId));
      if (!matchesCategory) return { valid: false, errorMessage: 'Coupon does not apply to selected categories' };
    }

    if (coupon.couponType !== CouponType.Platform) {
      if (!coupon.influencerId) {
        return { valid: false, errorMessage: 'Invalid coupon configuration.' };
      }
      const influencer = await this.influencersRepo.findOne({
        where: { id: coupon.influencerId, isDeleted: false },
      });
      if (!influencer || influencer.status !== InfluencerStatus.Active) {
        return { valid: false, errorMessage: 'This coupon is no longer available.' };
      }
    }

    if (context?.userId && coupon.perUserUsageLimit !== null && coupon.perUserUsageLimit !== undefined) {
      const userUsageCount = await this.couponUsageRepo.count({
        where: { couponCodeId: coupon.id, userId: context.userId },
      });
      if (userUsageCount >= coupon.perUserUsageLimit) {
        return { valid: false, errorMessage: 'You have already used this coupon the maximum number of times' };
      }
    }

    return {
      valid: true,
      couponCodeId: coupon.id,
      influencerId: coupon.influencerId ?? undefined,
      couponType: coupon.couponType,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      maxDiscountAmount: coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount),
      minimumOrderAmount: coupon.minimumOrderAmount === null ? null : Number(coupon.minimumOrderAmount),
      appliesToProductIds: coupon.appliesToProductIds,
      appliesToCategoryIds: coupon.appliesToCategoryIds,
      code: coupon.code,
      perUserUsageLimit: coupon.perUserUsageLimit,
      warningMessage: Number(coupon.discountValue) > 15 ? 'Discount above 15% may reduce margin.' : undefined,
    };
  }

  async calculateCommissionRate(influencerId: string): Promise<number> {
    const influencer = await this.influencersRepo.findOne({ where: { id: influencerId, isDeleted: false } });
    if (!influencer) throw new NotFoundException('Influencer not found');

    const successfulOrders = await this.commissionsRepo.count({
      where: [
        { influencerId, status: CommissionStatus.Approved, isDeleted: false },
        { influencerId, status: CommissionStatus.Paid, isDeleted: false },
      ],
    });

    let rules = await this.commissionRulesRepo.find({
      where: { influencerId, isActive: true, isDeleted: false },
      order: { minSuccessfulOrders: 'DESC' },
    });

    if (!rules.length) {
      rules = await this.commissionRulesRepo.find({
        where: { influencerId: IsNull(), isActive: true, isDeleted: false },
        order: { minSuccessfulOrders: 'DESC' },
      });
    }

    let rate = 10;
    if (!rules.length) {
      if (successfulOrders >= 500) rate = 20;
      else if (successfulOrders >= 200) rate = 15;
      else if (successfulOrders >= 100) rate = 12;
    } else {
      const matched = rules.find((rule) => successfulOrders >= rule.minSuccessfulOrders);
      rate = Number(matched?.commissionRate ?? rules[rules.length - 1].commissionRate);
    }

    const maxRate = influencer.maxCommissionRate === null ? null : Number(influencer.maxCommissionRate);
    if (maxRate !== null && maxRate < rate) {
      return maxRate;
    }

    return rate;
  }

  async createCommissionForOrder(params: CreateCommissionParams): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const commissionableAmount = Math.max(0, round2(params.subtotalAmount - params.discountAmount));
      const commissionRate = await this.calculateCommissionRate(params.influencerId);
      const commissionAmount = round2((commissionableAmount * commissionRate) / 100);

      await manager.save(InfluencerCommission, manager.create(InfluencerCommission, {
        influencerId: params.influencerId,
        couponCodeId: params.couponCodeId,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        userId: params.userId,
        subtotalAmount: params.subtotalAmount,
        orderTotal: params.orderTotal,
        discountAmount: params.discountAmount,
        commissionableAmount,
        commissionRate,
        commissionAmount,
        status: CommissionStatus.Approved,
        earnedAt: new Date(),
        paidAt: null,
        payoutId: null,
      }));

      const walletRepo = manager.getRepository(InfluencerWallet);
      let wallet = await walletRepo.findOne({
        where: { influencerId: params.influencerId, isDeleted: false },
      });
      if (!wallet) {
        wallet = walletRepo.create({
          influencerId: params.influencerId,
          pendingAmount: 0,
          approvedAmount: commissionAmount,
          paidAmountLifetime: 0,
          lastPayoutAt: null,
          currency: 'INR',
        });
      } else {
        wallet.approvedAmount = round2(Number(wallet.approvedAmount) + commissionAmount);
      }
      await walletRepo.save(wallet);

      const couponRepo = manager.getRepository(InfluencerCouponCode);
      const coupon = await couponRepo.findOne({ where: { id: params.couponCodeId, isDeleted: false } });
      if (coupon) {
        coupon.usageCount += 1;
        await couponRepo.save(coupon);
      }

      const usageRepo = manager.getRepository(CouponUsageRecord);
      const existingUsage = await usageRepo.findOne({ where: { orderId: params.orderId } });
      if (!existingUsage) {
        await usageRepo.save(usageRepo.create({
          couponCodeId: params.couponCodeId,
          userId: params.userId,
          orderId: params.orderId,
        }));
      }
    });
  }

  async recordCouponUsageForOrder(couponCodeId: string, userId: string, orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const usageRepo = manager.getRepository(CouponUsageRecord);
      const existing = await usageRepo.findOne({ where: { orderId } });
      if (existing) return;

      await usageRepo.save(usageRepo.create({ couponCodeId, userId, orderId }));

      const couponRepo = manager.getRepository(InfluencerCouponCode);
      const coupon = await couponRepo.findOne({ where: { id: couponCodeId, isDeleted: false } });
      if (coupon) {
        coupon.usageCount += 1;
        await couponRepo.save(coupon);
      }
    });
  }

  async settlePayoutFull(adminUserId: string, influencerId: string, dto: SettlePayoutDto): Promise<InfluencerPayout> {
    return this.dataSource.transaction(async (manager) => {
      const commissions = await manager.find(InfluencerCommission, {
        where: {
          influencerId,
          status: CommissionStatus.Approved,
          paidAt: IsNull(),
          isDeleted: false,
        },
        order: { createdAt: 'ASC' },
      });

      const totalApproved = round2(commissions.reduce((sum, commission) => sum + Number(commission.commissionAmount), 0));
      if (round2(dto.amount) !== totalApproved) {
        throw new BadRequestException('Payout amount must match total approved commissions');
      }

      const payout = await manager.save(InfluencerPayout, manager.create(InfluencerPayout, {
        influencerId,
        payoutNumber: await this.generatePayoutNumber(manager),
        amount: dto.amount,
        currency: 'INR',
        status: PayoutStatus.Paid,
        paymentMethod: dto.paymentMethod,
        paymentReference: dto.paymentReference ?? null,
        paymentProofUrl: dto.paymentProofUrl ?? null,
        paymentProofFileType: dto.paymentProofFileType ?? null,
        adminNote: dto.adminNote ?? null,
        paidByUserId: adminUserId,
        paidAt: new Date(),
      }));

      for (const commission of commissions) {
        await manager.save(InfluencerPayoutCommission, manager.create(InfluencerPayoutCommission, {
          payoutId: payout.id,
          commissionId: commission.id,
          amount: Number(commission.commissionAmount),
        }));
        commission.status = CommissionStatus.Paid;
        commission.paidAt = payout.paidAt;
        commission.payoutId = payout.id;
        await manager.save(InfluencerCommission, commission);
      }

      const walletRepo = manager.getRepository(InfluencerWallet);
      let wallet = await walletRepo.findOne({ where: { influencerId, isDeleted: false } });
      if (!wallet) {
        wallet = walletRepo.create({
          influencerId,
          pendingAmount: 0,
          approvedAmount: 0,
          paidAmountLifetime: dto.amount,
          lastPayoutAt: new Date(),
          currency: 'INR',
        });
      } else {
        wallet.approvedAmount = Math.max(0, round2(Number(wallet.approvedAmount) - dto.amount));
        wallet.paidAmountLifetime = round2(Number(wallet.paidAmountLifetime) + dto.amount);
        wallet.lastPayoutAt = new Date();
      }
      await walletRepo.save(wallet);

      return payout;
    });
  }

  async listInfluencers(filters: { search?: string; page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 20);

    const qb = this.influencersRepo.createQueryBuilder('influencer')
      .where('influencer.isDeleted = false');

    if (filters.search?.trim()) {
      qb.andWhere(
        '(influencer.name ILIKE :q OR influencer.code ILIKE :q OR influencer.email ILIKE :q OR influencer.platform ILIKE :q OR influencer.socialHandle ILIKE :q)',
        { q: `%${filters.search.trim()}%` },
      );
    }
    if (filters.status?.trim()) {
      qb.andWhere('influencer.status = :status', { status: filters.status.trim() });
    }

    const [influencers, total] = await qb
      .orderBy('influencer.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const wallets = influencers.length
      ? await this.walletsRepo.find({
          where: { influencerId: In(influencers.map((item) => item.id)), isDeleted: false },
        })
      : [];
    const walletMap = new Map(wallets.map((wallet) => [wallet.influencerId, wallet]));

    return {
      items: influencers.map((influencer) => ({
        ...influencer,
        wallet: {
          approvedAmount: Number(walletMap.get(influencer.id)?.approvedAmount ?? 0),
          paidAmountLifetime: Number(walletMap.get(influencer.id)?.paidAmountLifetime ?? 0),
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getInfluencerDetail(id: string) {
    const influencer = await this.influencersRepo.findOne({ where: { id, isDeleted: false } });
    if (!influencer) throw new NotFoundException('Influencer not found');

    const currentCommissionRate = await this.calculateCommissionRate(id);
    const [couponCodes, wallet, summary, recentCommissions, recentPayouts, linkedUser] = await Promise.all([
      this.couponCodesRepo.find({ where: { influencerId: id, isDeleted: false }, order: { createdAt: 'DESC' } }),
      this.getWallet(id),
      this.commissionsRepo
        .createQueryBuilder('commission')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(commission.commissionAmount), 0)', 'totalEarned')
        .where('commission.influencerId = :id', { id })
        .andWhere('commission.isDeleted = false')
        .getRawOne<{ count: string; totalEarned: string }>(),
      this.commissionsRepo.find({
        where: { influencerId: id, isDeleted: false },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.payoutsRepo.find({
        where: { influencerId: id, isDeleted: false },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      influencer.userId ? this.usersRepo.findOne({ where: { id: influencer.userId } }) : Promise.resolve(null),
    ]);

    return {
      ...influencer,
      wallet,
      currentCommissionRate,
      login: {
        enabled: Boolean(influencer.userId) && influencer.active && influencer.status === InfluencerStatus.Active,
        hasAccount: Boolean(influencer.userId),
        email: linkedUser?.email ?? influencer.email,
        lastLoginAt: influencer.lastLoginAt,
      },
      couponCodes,
      commissionSummary: {
        count: Number(summary?.count ?? 0),
        totalEarned: Number(summary?.totalEarned ?? 0),
      },
      economicsPreview: this.buildEconomicsPreview(currentCommissionRate, 10),
      recentCommissions: recentCommissions.map(normalizeCommission),
      recentPayouts: recentPayouts.map(normalizePayout),
    };
  }

  async createInfluencer(dto: Partial<Influencer>) {
    const temporaryPassword = this.readString(dto, 'temporaryPassword');
    const initialCouponCode = this.readString(dto, 'couponCode');
    const initialCouponDiscountType = this.readString(dto, 'initialCouponDiscountType') as CouponDiscountType | null;
    const initialCouponDiscountValue = this.readNullableNumber(dto, 'initialCouponDiscountValue');
    const initialCouponMaxDiscountAmount = this.readNullableNumber(dto, 'initialCouponMaxDiscountAmount');
    const initialCouponMinimumOrderAmount = this.readNullableNumber(dto, 'initialCouponMinimumOrderAmount');
    const initialCouponUsageLimit = this.readNullableNumber(dto, 'initialCouponUsageLimit');
    const initialCouponExpiresAt = this.readString(dto, 'initialCouponExpiresAt');

    return this.dataSource.transaction(async (manager) => {
      let linkedUserId: string | null = null;
      const email = dto.email?.toLowerCase?.() ?? dto.email ?? null;

      if (email && temporaryPassword) {
        const existingUser = await manager.findOne(User, { where: { email } });
        if (existingUser) throw new BadRequestException('Email is already registered');

        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        const user = await manager.save(User, manager.create(User, {
          email,
          passwordHash,
          name: dto.name,
          role: UserRole.Influencer,
          credits: 0,
        }));
        linkedUserId = user.id;
      }

      const influencerCode = await this.generateInfluencerCode(manager, dto.name ?? 'influencer');

      const dtoAny = dto as Record<string, unknown>;
      const rawRows = await manager.query(
        `INSERT INTO influencers (name, code, email, platform, phone, "socialHandle", "userId", "commissionPct", status, "maxCommissionRate", "paymentMethod", "paymentDetailsJson", notes, "lastLoginAt", active, "isDeleted", "deletedAt", "deletedBy")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, false, null, null)
         RETURNING id`,
        [
          dto.name ?? '',
          influencerCode,
          email,
          (dtoAny.platform ?? null),
          (dtoAny.phone ?? null),
          (dtoAny.socialHandle ?? null),
          linkedUserId,
          dto.commissionPct ?? 0,
          dto.status ?? InfluencerStatus.Active,
          this.readNullableNumber(dto, 'maxCommissionRate'),
          (dtoAny.paymentMethod ?? null),
          dto.paymentDetailsJson ?? null,
          (dtoAny.notes ?? null),
          null,
          dto.active ?? true,
        ],
      );

      const insertedId = rawRows[0].id as string;
      const influencer = await manager.findOneOrFail(Influencer, { where: { id: insertedId } });

      await manager.save(InfluencerWallet, manager.create(InfluencerWallet, {
        influencerId: influencer.id,
        pendingAmount: 0,
        approvedAmount: 0,
        paidAmountLifetime: 0,
        lastPayoutAt: null,
        currency: 'INR',
      }));

      if (initialCouponCode) {
        const existingCoupon = await manager.findOne(InfluencerCouponCode, {
          where: { code: ILike(initialCouponCode.trim().toUpperCase()), isDeleted: false },
        });
        if (existingCoupon) throw new BadRequestException('Coupon code already exists');
        if (!initialCouponDiscountType) throw new BadRequestException('Initial coupon discount type is required');
        if (initialCouponDiscountValue === null || initialCouponDiscountValue <= 0) {
          throw new BadRequestException('Initial coupon discount value is required');
        }

        await manager.save(InfluencerCouponCode, manager.create(InfluencerCouponCode, {
          influencerId: influencer.id,
          code: initialCouponCode.trim().toUpperCase(),
          discountType: initialCouponDiscountType,
          discountValue: initialCouponDiscountValue,
          maxDiscountAmount: initialCouponMaxDiscountAmount,
          isActive: true,
          startsAt: null,
          expiresAt: initialCouponExpiresAt ? new Date(initialCouponExpiresAt) : null,
          usageLimit: initialCouponUsageLimit === null ? null : Math.trunc(initialCouponUsageLimit),
          usageCount: 0,
          minimumOrderAmount: initialCouponMinimumOrderAmount,
          appliesToProductIds: null,
          appliesToCategoryIds: null,
        }));
      }

      return influencer;
    });
  }

  async updateInfluencer(id: string, dto: Partial<Influencer>) {
    const influencer = await this.influencersRepo.findOne({ where: { id, isDeleted: false } });
    if (!influencer) throw new NotFoundException('Influencer not found');
    Object.assign(influencer, dto);
    if (dto.email) {
      influencer.email = dto.email.toLowerCase();
    }
    const saved = await this.influencersRepo.save(influencer);

    if (saved.userId) {
      const linkedUser = await this.usersRepo.findOne({ where: { id: saved.userId } });
      if (linkedUser) {
        if (saved.email) linkedUser.email = saved.email.toLowerCase();
        linkedUser.name = saved.name;
        linkedUser.role = UserRole.Influencer;
        await this.usersRepo.save(linkedUser);
      }
    }

    return saved;
  }

  async softDeleteInfluencer(id: string, adminUserId: string) {
    const influencer = await this.influencersRepo.findOne({ where: { id, isDeleted: false } });
    if (!influencer) throw new NotFoundException('Influencer not found');
    influencer.isDeleted = true;
    influencer.deletedAt = new Date();
    influencer.deletedBy = adminUserId;
    await this.influencersRepo.save(influencer);
    return { id, deleted: true };
  }

  async createCouponCode(influencerId: string, dto: Partial<InfluencerCouponCode>) {
    await this.ensureInfluencerExists(influencerId);
    const code = (dto.code ?? '').trim().toUpperCase();
    if (!code) throw new BadRequestException('Coupon code is required');

    const existing = await this.couponCodesRepo.findOne({ where: { code: ILike(code), isDeleted: false } });
    if (existing) throw new BadRequestException('Coupon code already exists');

    return this.couponCodesRepo.save(this.couponCodesRepo.create({
      influencerId,
      couponType: CouponType.Influencer,
      code,
      discountType: dto.discountType ?? CouponDiscountType.Percentage,
      discountValue: dto.discountValue ?? 10,
      maxDiscountAmount: this.readNullableNumber(dto, 'maxDiscountAmount'),
      isActive: dto.isActive ?? true,
      startsAt: dto.startsAt ?? null,
      expiresAt: dto.expiresAt ?? null,
      usageLimit: dto.usageLimit ?? null,
      usageCount: 0,
      perUserUsageLimit: dto.perUserUsageLimit ?? null,
      minimumOrderAmount: this.readNullableNumber(dto, 'minimumOrderAmount'),
      appliesToProductIds: this.readStringArray(dto, 'appliesToProductIds'),
      appliesToCategoryIds: this.readStringArray(dto, 'appliesToCategoryIds'),
    }));
  }

  async updateCouponCode(id: string, dto: Partial<InfluencerCouponCode>) {
    const coupon = await this.couponCodesRepo.findOne({ where: { id, isDeleted: false } });
    if (!coupon) throw new NotFoundException('Coupon code not found');

    if (dto.code !== undefined) {
      const nextCode = dto.code.trim().toUpperCase();
      const existing = await this.couponCodesRepo.findOne({ where: { code: ILike(nextCode), isDeleted: false } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Coupon code already exists');
      }
      coupon.code = nextCode;
    }

    Object.assign(coupon, {
      discountType: dto.discountType ?? coupon.discountType,
      discountValue: dto.discountValue ?? coupon.discountValue,
      maxDiscountAmount: dto.maxDiscountAmount === undefined ? coupon.maxDiscountAmount : this.readNullableNumber(dto, 'maxDiscountAmount'),
      isActive: dto.isActive ?? coupon.isActive,
      startsAt: dto.startsAt === undefined ? coupon.startsAt : dto.startsAt,
      expiresAt: dto.expiresAt === undefined ? coupon.expiresAt : dto.expiresAt,
      usageLimit: dto.usageLimit === undefined ? coupon.usageLimit : dto.usageLimit,
      perUserUsageLimit: dto.perUserUsageLimit === undefined ? coupon.perUserUsageLimit : (dto.perUserUsageLimit ?? null),
      minimumOrderAmount: dto.minimumOrderAmount === undefined ? coupon.minimumOrderAmount : this.readNullableNumber(dto, 'minimumOrderAmount'),
      appliesToProductIds: dto.appliesToProductIds === undefined ? coupon.appliesToProductIds : this.readStringArray(dto, 'appliesToProductIds'),
      appliesToCategoryIds: dto.appliesToCategoryIds === undefined ? coupon.appliesToCategoryIds : this.readStringArray(dto, 'appliesToCategoryIds'),
    });

    return this.couponCodesRepo.save(coupon);
  }

  async listCouponCodes(influencerId: string) {
    return this.couponCodesRepo.find({
      where: { influencerId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async listCommissions(influencerId: string, page = 1, limit = 20) {
    const [items, total] = await this.commissionsRepo.findAndCount({
      where: { influencerId, isDeleted: false },
      order: { createdAt: 'DESC' },
      skip: (Math.max(1, page) - 1) * Math.max(1, limit),
      take: Math.max(1, limit),
    });

    return {
      items: items.map(normalizeCommission),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async listPayouts(influencerId: string) {
    const payouts = await this.payoutsRepo.find({
      where: { influencerId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
    return payouts.map(normalizePayout);
  }

  async createInfluencerLogin(influencerId: string, input: InfluencerLoginInput) {
    const influencer = await this.ensureInfluencerExists(influencerId);
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();
    if (!email || !password || password.length < 8) {
      throw new BadRequestException('Email and password are required');
    }

    return this.dataSource.transaction(async (manager) => {
      let user = influencer.userId
        ? await manager.findOne(User, { where: { id: influencer.userId } })
        : null;

      const existingByEmail = await manager.findOne(User, { where: { email } });
      if (existingByEmail && existingByEmail.id !== user?.id) {
        throw new BadRequestException('Email is already registered');
      }

      const passwordHash = await bcrypt.hash(password, 12);
      if (!user) {
        user = await manager.save(User, manager.create(User, {
          email,
          passwordHash,
          name: influencer.name,
          role: UserRole.Influencer,
          credits: 0,
        }));
        influencer.userId = user.id;
      } else {
        user.email = email;
        user.passwordHash = passwordHash;
        user.name = influencer.name;
        user.role = UserRole.Influencer;
        await manager.save(User, user);
      }

      influencer.email = email;
      influencer.active = true;
      influencer.status = InfluencerStatus.Active;
      await manager.save(Influencer, influencer);

      return {
        userId: influencer.userId,
        email,
        enabled: true,
      };
    });
  }

  async resetInfluencerPassword(influencerId: string, password: string) {
    const influencer = await this.ensureInfluencerExists(influencerId);
    if (!influencer.userId) throw new BadRequestException('Influencer login is not created yet');
    if (!password.trim() || password.trim().length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const user = await this.usersRepo.findOne({ where: { id: influencer.userId } });
    if (!user) throw new NotFoundException('Linked user not found');

    user.passwordHash = await bcrypt.hash(password.trim(), 12);
    await this.usersRepo.save(user);
    return { success: true };
  }

  async setInfluencerLoginEnabled(influencerId: string, enabled: boolean) {
    const influencer = await this.ensureInfluencerExists(influencerId);
    influencer.active = enabled;
    influencer.status = enabled ? InfluencerStatus.Active : InfluencerStatus.Inactive;
    await this.influencersRepo.save(influencer);
    return {
      enabled,
      status: influencer.status,
    };
  }

  async getWallet(influencerId: string) {
    const wallet = await this.walletsRepo.findOne({
      where: { influencerId, isDeleted: false },
    });
    if (!wallet) {
      return {
        influencerId,
        pendingAmount: 0,
        approvedAmount: 0,
        paidAmountLifetime: 0,
        lastPayoutAt: null,
        currency: 'INR',
      };
    }

    return {
      ...wallet,
      pendingAmount: Number(wallet.pendingAmount),
      approvedAmount: Number(wallet.approvedAmount),
      paidAmountLifetime: Number(wallet.paidAmountLifetime),
    };
  }

  async listCommissionRules(influencerId?: string | null) {
    const where = {
      influencerId: influencerId ?? IsNull(),
      isDeleted: false,
    };
    const rules = await this.commissionRulesRepo.find({
      where,
      order: { minSuccessfulOrders: 'ASC' },
    });
    return rules.map((rule) => ({
      ...rule,
      commissionRate: Number(rule.commissionRate),
    }));
  }

  async upsertCommissionRules(influencerId: string | null, rules: CommissionRuleInput[]) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(InfluencerCommissionRule);
      const existing = await repo.find({
        where: { influencerId: influencerId ?? IsNull(), isDeleted: false },
      });

      const now = new Date();
      for (const rule of existing) {
        rule.isDeleted = true;
        rule.deletedAt = now;
        rule.deletedBy = null;
        await repo.save(rule);
      }

      const created = repo.create(
        rules.map((rule) => ({
          influencerId,
          minSuccessfulOrders: rule.minSuccessfulOrders,
          commissionRate: rule.commissionRate,
          isActive: true,
        })),
      );
      return repo.save(created);
    });
  }

  async reverseCommissionForOrder(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const commissionsRepo = manager.getRepository(InfluencerCommission);
      const commission = await commissionsRepo.findOne({
        where: [
          { orderId, status: CommissionStatus.Pending, isDeleted: false },
          { orderId, status: CommissionStatus.Approved, isDeleted: false },
        ],
      });

      if (commission) {
        commission.status = CommissionStatus.Cancelled;
        await commissionsRepo.save(commission);

        const walletRepo = manager.getRepository(InfluencerWallet);
        const wallet = await walletRepo.findOne({
          where: { influencerId: commission.influencerId, isDeleted: false },
        });
        if (wallet) {
          wallet.approvedAmount = Math.max(0, round2(Number(wallet.approvedAmount) - Number(commission.commissionAmount)));
          await walletRepo.save(wallet);
        }

        // Decrement coupon usageCount and remove usage record
        const couponRepo = manager.getRepository(InfluencerCouponCode);
        const coupon = await couponRepo.findOne({ where: { id: commission.couponCodeId, isDeleted: false } });
        if (coupon && coupon.usageCount > 0) {
          coupon.usageCount -= 1;
          await couponRepo.save(coupon);
        }
      }

      // Delete usage record regardless of whether commission existed (handles platform coupons)
      const usageRepo = manager.getRepository(CouponUsageRecord);
      const usageRecord = await usageRepo.findOne({ where: { orderId } });
      if (usageRecord) {
        await usageRepo.remove(usageRecord);
      }
    });
  }

  async getPortalMe(userId: string) {
    const influencer = await this.influencersRepo.findOne({
      where: { userId, isDeleted: false },
    });
    if (!influencer) throw new NotFoundException('Influencer profile not found');

    const [wallet, couponCodes, commissionSummary, currentRate] = await Promise.all([
      this.getWallet(influencer.id),
      this.listCouponCodes(influencer.id),
      this.commissionsRepo
        .createQueryBuilder('commission')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(commission.orderTotal), 0)', 'revenue')
        .addSelect('COALESCE(SUM(commission.commissionAmount), 0)', 'earned')
        .where('commission.influencerId = :id', { id: influencer.id })
        .andWhere('commission.isDeleted = false')
        .getRawOne<{ count: string; revenue: string; earned: string }>(),
      this.calculateCommissionRate(influencer.id),
    ]);

    return {
      id: influencer.id,
      name: influencer.name,
      email: influencer.email,
      phone: influencer.phone,
      platform: influencer.platform,
      socialHandle: influencer.socialHandle,
      paymentMethod: influencer.paymentMethod,
      paymentDetailsJson: influencer.paymentDetailsJson,
      notes: influencer.notes,
      status: influencer.status,
      couponCodes,
      wallet,
      commissionSummary: {
        totalOrdersReferred: Number(commissionSummary?.count ?? 0),
        revenueGenerated: Number(commissionSummary?.revenue ?? 0),
        totalCommissionEarned: Number(commissionSummary?.earned ?? 0),
        currentCommissionRate: currentRate,
      },
    };
  }

  async updatePortalNotes(userId: string, notes: string | null) {
    const influencer = await this.influencersRepo.findOne({ where: { userId, isDeleted: false } });
    if (!influencer) throw new NotFoundException('Influencer profile not found');
    await this.influencersRepo.update(influencer.id, { notes: notes ?? null });
    return { ok: true };
  }

  async getPortalDashboardSummary(userId: string) {
    const influencer = await this.influencersRepo.findOne({ where: { userId, isDeleted: false } });
    if (!influencer) throw new NotFoundException('Influencer profile not found');

    const [wallet, couponCodes, summary, currentRate] = await Promise.all([
      this.getWallet(influencer.id),
      this.listCouponCodes(influencer.id),
      this.commissionsRepo
        .createQueryBuilder('commission')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(commission.orderTotal), 0)', 'revenue')
        .addSelect('COALESCE(SUM(commission.commissionAmount), 0)', 'earned')
        .where('commission.influencerId = :id', { id: influencer.id })
        .andWhere('commission.isDeleted = false')
        .getRawOne<{ count: string; revenue: string; earned: string }>(),
      this.calculateCommissionRate(influencer.id),
    ]);

    return {
      couponCodes: couponCodes.map((coupon) => ({
        ...coupon,
        discountValue: Number(coupon.discountValue),
      })),
      primaryCouponCode: couponCodes[0]?.code ?? influencer.code,
      currentCommissionRate: currentRate,
      totalOrdersReferred: Number(summary?.count ?? 0),
      revenueGenerated: Number(summary?.revenue ?? 0),
      currentWalletBalance: Number((wallet as { approvedAmount: number }).approvedAmount ?? 0),
      paidLifetime: Number((wallet as { paidAmountLifetime: number }).paidAmountLifetime ?? 0),
      pendingCommission: Number((wallet as { pendingAmount: number }).pendingAmount ?? 0),
      approvedCommission: Number((wallet as { approvedAmount: number }).approvedAmount ?? 0),
      lastPayoutDate: (wallet as { lastPayoutAt: Date | null }).lastPayoutAt ?? null,
    };
  }

  async getPortalOrders(
    userId: string,
    filters: { page?: number; limit?: number; dateFrom?: string; dateTo?: string; status?: string },
  ) {
    const influencer = await this.influencersRepo.findOne({ where: { userId, isDeleted: false } });
    if (!influencer) throw new NotFoundException('Influencer profile not found');

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 20);
    const qb = this.commissionsRepo.createQueryBuilder('commission')
      .where('commission.influencerId = :id', { id: influencer.id })
      .andWhere('commission.isDeleted = false');

    if (filters.status?.trim()) {
      qb.andWhere('commission.status = :status', { status: filters.status.trim() });
    }
    if (filters.dateFrom) {
      qb.andWhere('commission.createdAt >= :dateFrom', { dateFrom: new Date(filters.dateFrom) });
    }
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      qb.andWhere('commission.createdAt <= :dateTo', { dateTo });
    }

    const [commissions, total] = await qb
      .orderBy('commission.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const orders = commissions.length
      ? await this.ordersRepo.find({ where: { id: In(commissions.map((item) => item.orderId)) } })
      : [];
    const orderMap = new Map(orders.map((order) => [order.id, order]));

    return {
      items: commissions.map((commission) => {
        const order = orderMap.get(commission.orderId);
        const customerName = order?.customerName?.trim();
        const maskedCustomer = customerName
          ? customerName.split(' ')[0]
          : `Customer #${commission.userId.slice(0, 6).toUpperCase()}`;

        return {
          id: commission.id,
          orderDate: order?.createdAt ?? commission.createdAt,
          orderNumber: commission.orderNumber,
          customer: maskedCustomer,
          orderTotal: Number(commission.orderTotal),
          discountGiven: Number(commission.discountAmount),
          commissionRate: Number(commission.commissionRate),
          commissionAmount: Number(commission.commissionAmount),
          commissionStatus: commission.status,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getPortalPayouts(
    userId: string,
    filters: { page?: number; limit?: number; dateFrom?: string; dateTo?: string },
  ) {
    const influencer = await this.influencersRepo.findOne({ where: { userId, isDeleted: false } });
    if (!influencer) throw new NotFoundException('Influencer profile not found');

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 20);
    const qb = this.payoutsRepo.createQueryBuilder('payout')
      .where('payout.influencerId = :id', { id: influencer.id })
      .andWhere('payout.isDeleted = false');

    if (filters.dateFrom) {
      qb.andWhere('payout.createdAt >= :dateFrom', { dateFrom: new Date(filters.dateFrom) });
    }
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      qb.andWhere('payout.createdAt <= :dateTo', { dateTo });
    }

    const [items, total] = await qb
      .orderBy('payout.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: items.map((payout) => ({
        id: payout.id,
        payoutNumber: payout.payoutNumber,
        amount: Number(payout.amount),
        paymentMethod: payout.paymentMethod,
        paymentReference: payout.paymentReference,
        paidDate: payout.paidAt,
        status: payout.status,
        paymentProofUrl: payout.paymentProofUrl,
        paymentProofFileType: payout.paymentProofFileType,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async ensureInfluencerExists(influencerId: string) {
    const influencer = await this.influencersRepo.findOne({ where: { id: influencerId, isDeleted: false } });
    if (!influencer) throw new NotFoundException('Influencer not found');
    return influencer;
  }

  private readString(dto: Partial<Influencer>, key: string): string | null {
    const value = (dto as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private readNullableNumber(dto: object, key: string): number | null {
    const value = (dto as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === '') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private readStringArray(dto: object, key: string): string[] | null {
    const value = (dto as Record<string, unknown>)[key];
    if (!Array.isArray(value)) return null;
    const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return strings.length ? strings : null;
  }

  buildEconomicsPreview(commissionRate: number, discountRate: number, exampleSubtotal = 1000) {
    const customerDiscount = round2((exampleSubtotal * discountRate) / 100);
    const customerPays = round2(exampleSubtotal - customerDiscount);
    const influencerCommission = round2((customerPays * commissionRate) / 100);
    const totalMarketingCost = round2(customerDiscount + influencerCommission);
    const effectiveMarketingCost = round2((totalMarketingCost / exampleSubtotal) * 100);

    return {
      exampleSubtotal,
      customerDiscount,
      customerPays,
      influencerCommission,
      totalMarketingCost,
      effectiveMarketingCost,
      warning: discountRate > 15 || discountRate + commissionRate > 25
        ? 'High discount + high commission may reduce margin.'
        : null,
    };
  }

  private async generatePayoutNumber(manager: DataSource['manager']): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const random = randomBytes(3).toString('hex').slice(0, 6).toUpperCase();
      const candidate = `PAY-${stamp}-${random}`;
      const existing = await manager.findOne(InfluencerPayout, { where: { payoutNumber: candidate } });
      if (!existing) return candidate;
    }
    throw new BadRequestException('Could not generate unique payout number');
  }

  private async generateInfluencerCode(manager: DataSource['manager'], name: string): Promise<string> {
    const normalized = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8) || 'INFL';

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = randomBytes(2).toString('hex').toUpperCase();
      const candidate = `${normalized}${suffix}`;
      const existing = await manager.findOne(Influencer, { where: { code: candidate } });
      if (!existing) return candidate;
    }

    throw new BadRequestException('Could not generate unique influencer code');
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeCommission(commission: InfluencerCommission) {
  return {
    ...commission,
    orderTotal: Number(commission.orderTotal),
    discountAmount: Number(commission.discountAmount),
    commissionRate: Number(commission.commissionRate),
    commissionAmount: Number(commission.commissionAmount),
  };
}

function normalizePayout(payout: InfluencerPayout) {
  return {
    ...payout,
    amount: Number(payout.amount),
  };
}

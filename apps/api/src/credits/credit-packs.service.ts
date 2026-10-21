import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import type Razorpay from 'razorpay';
import { DataSource, Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { CouponDiscountType, CouponType, InfluencerCouponCode } from '../influencers/influencer-coupon-code.entity';
import { InfluencerCommission } from '../influencers/influencer-commission.entity';
import { InfluencersService } from '../influencers/influencers.service';
import { OrderStatusHistory } from '../merchandise/order-status-history.entity';
import { CommerceOrderStatus, CommerceOrderType, Order } from '../merchandise/orders/order.entity';
import { User } from '../users/user.entity';
import { CreditPack, CreditPackType } from './credit-pack.entity';
import { CreditTransaction, CreditTransactionReason } from './credit-transaction.entity';

type CreditPackPayload = Partial<CreditPack>;

/** What a pack costs this user, with the coupon (if any) already applied. */
export interface PackPricing {
  subtotal: number;
  discount: number;
  total: number;
  /** Set when the pack limit (CREDIT_PACK_MAX_COUPON_DISCOUNT_PCT) cut the coupon down — shown to the customer. */
  cappedAtPct?: number;
  coupon: {
    code: string;
    couponCodeId: string;
    influencerId: string | null;
    couponType: CouponType;
    discountType: CouponDiscountType;
    discountValue: number;
  } | null;
}

/** Razorpay's smallest chargeable amount. */
const MIN_CHARGE_INR = 1;

@Injectable()
export class CreditPacksService {
  private readonly logger = new Logger(CreditPacksService.name);
  private _razorpay: Razorpay | null = null;

  private get razorpay(): Razorpay {
    if (!this._razorpay) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        throw new Error(`Razorpay keys not configured (RAZORPAY_KEY_ID=${keyId ? 'set' : 'MISSING'}, RAZORPAY_KEY_SECRET=${keySecret ? 'set' : 'MISSING'})`);
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RazorpayClass = require('razorpay') as typeof Razorpay;
      this._razorpay = new RazorpayClass({ key_id: keyId, key_secret: keySecret });
    }
    return this._razorpay;
  }

  constructor(
    @InjectRepository(CreditPack)
    private readonly creditPacksRepository: Repository<CreditPack>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(CreditTransaction)
    private readonly transactionsRepository: Repository<CreditTransaction>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistoryRepository: Repository<OrderStatusHistory>,
    @InjectRepository(PlatformSetting)
    private readonly platformSettingsRepository: Repository<PlatformSetting>,
    private readonly dataSource: DataSource,
    private readonly influencersService: InfluencersService,
  ) {}

  computeEffectivePrice(pack: CreditPack): { effectivePrice: number; isOnSale: boolean; savingsAmount: number; savingsPct: number } {
    const now = new Date();
    const inWindow = (!pack.promotionStart || pack.promotionStart <= now) && (!pack.promotionEnd || pack.promotionEnd >= now);
    const basePrice = Number(pack.basePrice);
    const salePrice = pack.salePrice === null ? null : Number(pack.salePrice);
    const effectivePrice = inWindow && salePrice !== null ? salePrice : basePrice;
    const isOnSale = inWindow && salePrice !== null;
    const savingsAmount = Math.max(0, round2(basePrice - effectivePrice));
    const savingsPct = basePrice > 0 ? Math.round((savingsAmount / basePrice) * 100) : 0;

    return { effectivePrice, isOnSale, savingsAmount, savingsPct };
  }

  async listActivePacks() {
    const packs = await this.creditPacksRepository.find({
      where: { isActive: true, isDeleted: false },
      order: { sortOrder: 'ASC' },
    });
    return packs.map((pack) => this.serializePack(pack));
  }

  async listAllPacks() {
    const packs = await this.creditPacksRepository.find({
      where: { isDeleted: false },
      order: { sortOrder: 'ASC' },
    });
    return packs.map((pack) => this.serializePack(pack));
  }

  async createPack(dto: CreditPackPayload) {
    this.validatePackInput(dto);
    const pack = this.creditPacksRepository.create({
      name: dto.name!,
      slug: dto.slug!,
      description: dto.description ?? null,
      basePrice: dto.basePrice!,
      salePrice: dto.salePrice ?? null,
      currency: dto.currency ?? 'INR',
      packType: dto.packType ?? CreditPackType.StoryCredits,
      credits: dto.credits ?? 0,
      bonusCredits: dto.bonusCredits ?? 0,
      characterSlots: dto.characterSlots ?? 0,
      avatarRefreshTokens: dto.avatarRefreshTokens ?? 0,
      promotionName: dto.promotionName ?? null,
      promotionType: dto.promotionType ?? null,
      promotionValue: dto.promotionValue ?? null,
      promotionStart: dto.promotionStart ? new Date(dto.promotionStart) : null,
      promotionEnd: dto.promotionEnd ? new Date(dto.promotionEnd) : null,
      badge: dto.badge ?? null,
      isFeatured: dto.isFeatured ?? false,
      isMostPopular: dto.isMostPopular ?? false,
      isBestValue: dto.isBestValue ?? false,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    });
    const saved = await this.creditPacksRepository.save(pack);
    return this.serializePack(saved);
  }

  async updatePack(id: string, dto: CreditPackPayload) {
    const pack = await this.creditPacksRepository.findOne({ where: { id, isDeleted: false } });
    if (!pack) throw new NotFoundException('Credit pack not found');

    const next = {
      ...pack,
      ...dto,
      promotionStart: dto.promotionStart === undefined ? pack.promotionStart : dto.promotionStart ? new Date(dto.promotionStart) : null,
      promotionEnd: dto.promotionEnd === undefined ? pack.promotionEnd : dto.promotionEnd ? new Date(dto.promotionEnd) : null,
    };
    this.validatePackInput(next);

    Object.assign(pack, {
      ...dto,
      promotionStart: next.promotionStart,
      promotionEnd: next.promotionEnd,
    });

    const saved = await this.creditPacksRepository.save(pack);
    return this.serializePack(saved);
  }

  async deletePack(id: string, adminId: string) {
    const pack = await this.creditPacksRepository.findOne({ where: { id, isDeleted: false } });
    if (!pack) throw new NotFoundException('Credit pack not found');
    pack.isDeleted = true;
    pack.deletedAt = new Date();
    pack.deletedBy = adminId;
    await this.creditPacksRepository.save(pack);
    return { id, deleted: true };
  }

  /** Prices every active pack with a coupon so the shop can show the discounted amounts before paying. */
  async quoteCoupon(userId: string, code: string) {
    const packs = await this.creditPacksRepository.find({ where: { isActive: true, isDeleted: false } });
    const quotes: Record<string, { subtotal: number; discount: number; total: number; cappedAtPct?: number; error?: string }> = {};
    let firstError: string | undefined;
    for (const pack of packs) {
      try {
        const { subtotal, discount, total, cappedAtPct } = await this.priceWithCoupon(userId, pack, code);
        quotes[pack.id] = { subtotal, discount, total, cappedAtPct };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Coupon could not be applied';
        firstError ??= message;
        const { effectivePrice } = this.computeEffectivePrice(pack);
        quotes[pack.id] = { subtotal: effectivePrice, discount: 0, total: effectivePrice, error: message };
      }
    }
    const valid = Object.values(quotes).some((q) => q.discount > 0);
    return { valid, code: code.trim().toUpperCase(), errorMessage: valid ? undefined : firstError ?? 'Coupon could not be applied', quotes };
  }

  async initiatePurchase(
    userId: string,
    packId: string,
    couponCode?: string,
  ): Promise<{ razorpayOrderId: string; amount: number; subtotal: number; discount: number; currency: string; keyId: string }> {
    const pack = await this.creditPacksRepository.findOne({ where: { id: packId, isActive: true, isDeleted: false } });
    if (!pack) throw new NotFoundException('Credit pack not found');

    const pricing = await this.priceWithCoupon(userId, pack, couponCode);
    // Everything needed to credit the purchase travels with the Razorpay order, so verify
    // trusts what was priced here rather than what the client sends back.
    const order = await this.razorpay.orders.create({
      amount: Math.round(pricing.total * 100),
      currency: pack.currency,
      notes: {
        userId,
        packId,
        packName: pack.name,
        subtotal: String(pricing.subtotal),
        discount: String(pricing.discount),
        couponCodeId: pricing.coupon?.couponCodeId ?? '',
      },
    });

    return {
      razorpayOrderId: order.id,
      amount: pricing.total,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      currency: pack.currency,
      keyId: process.env.RAZORPAY_KEY_ID ?? '',
    };
  }

  async verifyAndCredit(
    userId: string,
    packId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<{ newBalance: number; characterSlotsTotal: number; avatarRefreshTokens: number }> {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(body)
      .digest('hex');
    if (expectedSignature !== razorpaySignature) {
      throw new UnauthorizedException('Invalid payment signature');
    }

    const duplicate = await this.transactionsRepository.findOne({
      where: { razorpayPaymentId },
    });
    if (duplicate) {
      throw new ConflictException('Payment already processed');
    }

    // The signature only proves this payment belongs to this order — the order itself says
    // who paid, for which pack, and how much (a cheap order must not unlock a bigger pack).
    const rzpOrder = await this.razorpay.orders.fetch(razorpayOrderId);
    const notes = (rzpOrder.notes ?? {}) as Record<string, string | number | undefined>;
    if (notes.userId !== userId || notes.packId !== packId) {
      throw new BadRequestException('This payment does not match the selected pack');
    }

    const pack = await this.creditPacksRepository.findOne({ where: { id: packId, isDeleted: false } });
    if (!pack) throw new NotFoundException('Credit pack not found');

    const total = round2(Number(rzpOrder.amount) / 100);
    const subtotal = Number(notes.subtotal ?? total);
    const discount = Number(notes.discount ?? 0);
    const couponCodeId = typeof notes.couponCodeId === 'string' && notes.couponCodeId ? notes.couponCodeId : null;

    const result = await this.creditUser(userId, pack, total, razorpayOrderId, razorpayPaymentId);
    await this.recordCreditOrder(userId, pack, { subtotal, discount, total }, couponCodeId, razorpayOrderId, razorpayPaymentId, result.user);
    return { newBalance: result.newBalance, characterSlotsTotal: result.characterSlotsTotal, avatarRefreshTokens: result.avatarRefreshTokens };
  }

  /** Test-only purchase that skips Razorpay; the controller blocks it in production for non-admins. */
  async mockPurchase(
    userId: string,
    packId: string,
    paymentMethod = 'mock',
    couponCode?: string,
  ): Promise<{ newBalance: number; characterSlotsTotal: number; avatarRefreshTokens: number }> {
    const pack = await this.creditPacksRepository.findOne({ where: { id: packId, isActive: true, isDeleted: false } });
    if (!pack) throw new NotFoundException('Credit pack not found');

    const pricing = await this.priceWithCoupon(userId, pack, couponCode);
    const mockPaymentId = `${paymentMethod}_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mockOrderId = `mock_order_${Date.now()}`;

    const result = await this.creditUser(userId, pack, pricing.total, mockOrderId, mockPaymentId);
    await this.recordCreditOrder(userId, pack, pricing, pricing.coupon?.couponCodeId ?? null, mockOrderId, mockPaymentId, result.user);
    return { newBalance: result.newBalance, characterSlotsTotal: result.characterSlotsTotal, avatarRefreshTokens: result.avatarRefreshTokens };
  }

  private async creditUser(userId: string, pack: CreditPack, pricePaid: number, razorpayOrderId: string, razorpayPaymentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new NotFoundException('User not found');

      const alreadyProcessed = await manager.findOne(CreditTransaction, {
        where: { razorpayPaymentId },
      });
      if (alreadyProcessed) {
        throw new ConflictException('Payment already processed');
      }

      this.applyPackToUser(user, pack);
      await manager.save(user);

      await manager.save(
        manager.create(CreditTransaction, {
          userId,
          delta: this.getStoryCreditDelta(pack),
          reason: CreditTransactionReason.Purchase,
          referenceId: razorpayOrderId,
          bonusCredits: pack.bonusCredits,
          characterSlotsDelta: pack.characterSlots,
          avatarRefreshTokensDelta: pack.avatarRefreshTokens,
          packId: pack.id,
          packName: pack.name,
          pricePaid,
          razorpayOrderId,
          razorpayPaymentId,
        }),
      );

      return { user, newBalance: user.credits, characterSlotsTotal: user.characterSlotsTotal, avatarRefreshTokens: user.avatarRefreshTokens };
    });
  }

  /**
   * Prices a pack for this user. Coupons work on credit packs exactly like on store orders
   * (influencer or site-wide), but the discount is capped by CREDIT_PACK_MAX_COUPON_DISCOUNT_PCT
   * so a generous coupon plus an influencer commission can't push a pack below cost.
   */
  private async priceWithCoupon(userId: string, pack: CreditPack, couponCode?: string): Promise<PackPricing> {
    const subtotal = this.computeEffectivePrice(pack).effectivePrice;
    const code = couponCode?.trim();
    if (!code) return { subtotal, discount: 0, total: subtotal, coupon: null };

    const coupon = await this.influencersService.validateCoupon(code, {
      subtotalAmount: subtotal,
      productIds: [pack.id],
      userId,
    });
    if (!coupon.valid || !coupon.couponCodeId || !coupon.discountType || !coupon.couponType) {
      throw new BadRequestException(coupon.errorMessage ?? 'Coupon code is not valid');
    }

    let discount = coupon.discountType === CouponDiscountType.Percentage
      ? round2((subtotal * (coupon.discountValue ?? 0)) / 100)
      : Math.min(coupon.discountValue ?? 0, subtotal);
    if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount !== undefined) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
    const maxPct = await this.getNumberSetting('CREDIT_PACK_MAX_COUPON_DISCOUNT_PCT');
    const packLimit = round2((subtotal * maxPct) / 100);
    const cappedAtPct = discount > packLimit ? maxPct : undefined;
    discount = Math.min(discount, packLimit, subtotal - MIN_CHARGE_INR);
    // Whole rupees, so the shop shows clean prices (₹134, not ₹134.10).
    discount = Math.max(0, Math.floor(discount));

    return {
      subtotal,
      discount,
      total: round2(subtotal - discount),
      cappedAtPct,
      coupon: {
        code: coupon.code ?? code,
        couponCodeId: coupon.couponCodeId,
        influencerId: coupon.influencerId ?? null,
        couponType: coupon.couponType,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue ?? 0,
      },
    };
  }

  private async getNumberSetting(key: string): Promise<number> {
    const row = await this.platformSettingsRepository.findOne({ where: { key } });
    const value = Number(row?.value ?? SETTING_DEFAULTS[key]?.value);
    return Number.isFinite(value) ? value : 0;
  }

  private async isSandboxMode(): Promise<boolean> {
    const row = await this.platformSettingsRepository.findOne({ where: { key: 'SANDBOX_MODE' } });
    if (row) return row.value === 'true' || row.value === '1';
    return SETTING_DEFAULTS['SANDBOX_MODE']?.value === 'true';
  }

  private generateOrderNumber(): string {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `HKU-CP-${stamp}-${random}`;
  }

  /** Writes the purchase into Orders (so it shows in admin/reports) and settles the coupon: usage + influencer commission. */
  private async recordCreditOrder(
    userId: string,
    pack: CreditPack,
    pricing: { subtotal: number; discount: number; total: number },
    couponCodeId: string | null,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    user: User,
  ): Promise<void> {
    try {
      const isSandbox = await this.isSandboxMode();
      const coupon = couponCodeId
        ? await this.dataSource.getRepository(InfluencerCouponCode).findOne({ where: { id: couponCodeId } })
        : null;
      const isInfluencerCoupon = !!coupon?.influencerId && coupon.couponType !== CouponType.Platform;

      const order = await this.ordersRepository.save(this.ordersRepository.create({
        userId,
        orderNumber: this.generateOrderNumber(),
        orderType: CommerceOrderType.CreditPurchase,
        status: CommerceOrderStatus.DigitalReady,
        subtotalAmount: pricing.subtotal,
        discountAmount: pricing.discount,
        couponCode: coupon?.code ?? null,
        couponCodeId: coupon?.id ?? null,
        influencerId: isInfluencerCoupon ? coupon.influencerId : null,
        couponType: coupon?.couponType ?? null,
        couponDiscountType: coupon?.discountType ?? null,
        couponDiscountValue: coupon ? Number(coupon.discountValue) : null,
        couponDiscountAmount: coupon ? pricing.discount : null,
        shippingAmount: 0,
        taxAmount: 0,
        totalAmount: pricing.total,
        currency: pack.currency ?? 'INR',
        customerName: user.name ?? null,
        customerEmail: user.email ?? null,
        customerPhone: null,
        paymentMethod: null,
        adminNotes: `Credit pack: ${pack.name} | +${pack.credits + pack.bonusCredits} credits | Razorpay: ${razorpayPaymentId}`,
        isSandbox,
      }));
      await this.statusHistoryRepository.save(
        this.statusHistoryRepository.create({
          orderId: order.id,
          oldStatus: null,
          newStatus: CommerceOrderStatus.DigitalReady,
          note: `Credit pack purchase: ${pack.name}${coupon ? ` (coupon ${coupon.code})` : ''}`,
          changedByUserId: userId,
        }),
      );

      if (!coupon) return;
      if (isInfluencerCoupon && coupon.influencerId) {
        await this.influencersService.createCommissionForOrder({
          influencerId: coupon.influencerId,
          couponCodeId: coupon.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId,
          subtotalAmount: pricing.subtotal,
          orderTotal: pricing.total,
          discountAmount: pricing.discount,
          shippingAmount: 0,
          taxAmount: 0,
        });
        const commission = await this.dataSource.getRepository(InfluencerCommission).findOne({ where: { orderId: order.id } });
        if (commission) {
          await this.ordersRepository.update(order.id, {
            influencerCommissionRate: Number(commission.commissionRate),
            influencerCommissionAmount: Number(commission.commissionAmount),
          });
        }
      } else {
        await this.influencersService.recordCouponUsageForOrder(coupon.id, userId, order.id);
      }
    } catch (err) {
      // Credits are already in the user's wallet — a bookkeeping failure must not fail the purchase.
      this.logger.error(`Credit order bookkeeping failed for payment ${razorpayPaymentId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private validatePackInput(dto: CreditPackPayload) {
    const packType = dto.packType ?? CreditPackType.StoryCredits;
    const credits = Number(dto.credits ?? 0);
    const bonusCredits = Number(dto.bonusCredits ?? 0);
    const characterSlots = Number(dto.characterSlots ?? 0);
    const avatarRefreshTokens = Number(dto.avatarRefreshTokens ?? 0);
    const basePrice = Number(dto.basePrice);
    const salePrice = dto.salePrice === null || dto.salePrice === undefined ? null : Number(dto.salePrice);
    const promotionStart = dto.promotionStart ? new Date(dto.promotionStart) : null;
    const promotionEnd = dto.promotionEnd ? new Date(dto.promotionEnd) : null;

    if (packType === CreditPackType.StoryCredits && !(credits > 0)) {
      throw new BadRequestException('Story credit packs must include at least 1 story credit');
    }
    if (packType === CreditPackType.CharacterSlots && !(characterSlots > 0)) {
      throw new BadRequestException('Character slot packs must include at least 1 character slot');
    }
    if (packType === CreditPackType.AvatarRefreshes && !(avatarRefreshTokens > 0)) {
      throw new BadRequestException('Avatar refresh packs must include at least 1 avatar refresh');
    }
    if (!(bonusCredits >= 0)) throw new BadRequestException('bonusCredits must be greater than or equal to 0');
    if (!(characterSlots >= 0)) throw new BadRequestException('characterSlots must be greater than or equal to 0');
    if (!(avatarRefreshTokens >= 0)) throw new BadRequestException('avatarRefreshTokens must be greater than or equal to 0');
    if (salePrice !== null && salePrice > basePrice) throw new BadRequestException('salePrice must be less than or equal to basePrice');
    if (promotionStart && promotionEnd && promotionEnd <= promotionStart) {
      throw new BadRequestException('promotionEnd must be after promotionStart');
    }
  }

  private serializePack(pack: CreditPack) {
    const computed = this.computeEffectivePrice(pack);
    return {
      ...pack,
      ...computed,
      totalCredits: pack.credits + pack.bonusCredits,
    };
  }

  private applyPackToUser(user: User, pack: CreditPack) {
    user.credits += this.getStoryCreditDelta(pack);
    user.characterSlotsTotal += pack.characterSlots;
    user.avatarRefreshTokens += pack.avatarRefreshTokens;
  }

  private getStoryCreditDelta(pack: CreditPack): number {
    return pack.credits + pack.bonusCredits;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

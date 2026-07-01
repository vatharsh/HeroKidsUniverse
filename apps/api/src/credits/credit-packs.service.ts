import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import type Razorpay from 'razorpay';
import { DataSource, Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { OrderStatusHistory } from '../merchandise/order-status-history.entity';
import { CommerceOrderStatus, CommerceOrderType, Order } from '../merchandise/orders/order.entity';
import { User } from '../users/user.entity';
import { CreditPack, CreditPackType } from './credit-pack.entity';
import { CreditTransaction, CreditTransactionReason } from './credit-transaction.entity';

type CreditPackPayload = Partial<CreditPack>;

@Injectable()
export class CreditPacksService {
  private _razorpay: Razorpay | null = null;

  private get razorpay(): Razorpay {
    if (!this._razorpay) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RazorpayClass = require('razorpay') as typeof Razorpay;
      this._razorpay = new RazorpayClass({
        key_id: process.env.RAZORPAY_KEY_ID ?? '',
        key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
      });
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

  async initiatePurchase(userId: string, packId: string): Promise<{ razorpayOrderId: string; amount: number; currency: string; keyId: string }> {
    const pack = await this.creditPacksRepository.findOne({ where: { id: packId, isActive: true, isDeleted: false } });
    if (!pack) throw new NotFoundException('Credit pack not found');

    const { effectivePrice } = this.computeEffectivePrice(pack);
    const order = await this.razorpay.orders.create({
      amount: Math.round(effectivePrice * 100),
      currency: pack.currency,
      notes: { userId, packId, packName: pack.name },
    });

    return {
      razorpayOrderId: order.id,
      amount: effectivePrice,
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

    const pack = await this.creditPacksRepository.findOne({ where: { id: packId, isDeleted: false } });
    if (!pack) throw new NotFoundException('Credit pack not found');
    const { effectivePrice } = this.computeEffectivePrice(pack);

    const result = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId } });
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
          pricePaid: effectivePrice,
          razorpayOrderId,
          razorpayPaymentId,
        }),
      );

      return { user, newBalance: user.credits, characterSlotsTotal: user.characterSlotsTotal, avatarRefreshTokens: user.avatarRefreshTokens };
    });

    void this.createCreditOrder(userId, pack, effectivePrice, razorpayOrderId, razorpayPaymentId, result.user);
    return { newBalance: result.newBalance, characterSlotsTotal: result.characterSlotsTotal, avatarRefreshTokens: result.avatarRefreshTokens };
  }

  async mockPurchase(
    userId: string,
    packId: string,
    paymentMethod = 'mock',
  ): Promise<{ newBalance: number; characterSlotsTotal: number; avatarRefreshTokens: number }> {
    const pack = await this.creditPacksRepository.findOne({ where: { id: packId, isActive: true, isDeleted: false } });
    if (!pack) throw new NotFoundException('Credit pack not found');

    const { effectivePrice } = this.computeEffectivePrice(pack);
    const mockPaymentId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mockOrderId = `mock_order_${Date.now()}`;

    const result = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      this.applyPackToUser(user, pack);
      await manager.save(user);

      await manager.save(
        manager.create(CreditTransaction, {
          userId,
          delta: this.getStoryCreditDelta(pack),
          reason: CreditTransactionReason.Purchase,
          referenceId: mockOrderId,
          bonusCredits: pack.bonusCredits,
          characterSlotsDelta: pack.characterSlots,
          avatarRefreshTokensDelta: pack.avatarRefreshTokens,
          packId: pack.id,
          packName: pack.name,
          pricePaid: effectivePrice,
          razorpayOrderId: mockOrderId,
          razorpayPaymentId: `${paymentMethod}_${mockPaymentId}`,
        }),
      );

      return { user, newBalance: user.credits, characterSlotsTotal: user.characterSlotsTotal, avatarRefreshTokens: user.avatarRefreshTokens };
    });

    void this.createCreditOrder(userId, pack, effectivePrice, mockOrderId, `${paymentMethod}_${mockPaymentId}`, result.user);
    return { newBalance: result.newBalance, characterSlotsTotal: result.characterSlotsTotal, avatarRefreshTokens: result.avatarRefreshTokens };
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

  private async createCreditOrder(
    userId: string,
    pack: CreditPack,
    effectivePrice: number,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    user: User,
  ): Promise<void> {
    const isSandbox = await this.isSandboxMode();
    const order = this.ordersRepository.create({
      userId,
      orderNumber: this.generateOrderNumber(),
      orderType: CommerceOrderType.CreditPurchase,
      status: CommerceOrderStatus.DigitalReady,
      subtotalAmount: effectivePrice,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      totalAmount: effectivePrice,
      currency: pack.currency ?? 'INR',
      customerName: user.name ?? null,
      customerEmail: user.email ?? null,
      customerPhone: null,
      paymentMethod: null,
      adminNotes: `Credit pack: ${pack.name} | +${pack.credits + pack.bonusCredits} credits | Razorpay: ${razorpayPaymentId}`,
      isSandbox,
    });
    const saved = await this.ordersRepository.save(order);
    await this.statusHistoryRepository.save(
      this.statusHistoryRepository.create({
        orderId: saved.id,
        oldStatus: null,
        newStatus: CommerceOrderStatus.DigitalReady,
        note: `Credit pack purchase: ${pack.name}`,
        changedByUserId: userId,
      }),
    );
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

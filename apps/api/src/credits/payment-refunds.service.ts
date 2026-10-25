import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import type Razorpay from 'razorpay';
import { DataSource, EntityManager } from 'typeorm';

import { InfluencersService } from '../influencers/influencers.service';
import { MailService } from '../mail/mail.service';
import { refundIssuedEmail } from '../mail/payment-receipt-email';
import { OrderStatusHistory } from '../merchandise/order-status-history.entity';
import { CommerceOrderStatus, CommerceOrderType, Order } from '../merchandise/orders/order.entity';
import { User } from '../users/user.entity';
import { CreditTransaction, CreditTransactionReason } from './credit-transaction.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface RefundPreview {
  orderId: string;
  orderNumber: string;
  paymentId: string | null;
  /** Mock / test-only purchases have no real Razorpay payment and can't be refunded through Razorpay. */
  refundable: boolean;
  reason: string | null;
  paid: number;
  alreadyRefunded: number;
  maxRefund: number;
  granted: { credits: number; refreshes: number; slots: number };
  /** What the parent still has of this pack — what a refund takes back. */
  unused: { credits: number; refreshes: number; slots: number };
  /** Paid amount × share of the pack still unused. */
  suggestedAmount: number;
}

/**
 * Money refunds for credit-pack purchases, through Razorpay.
 *
 * Both paths — the admin "Refund payment" button and Razorpay's refund webhook (refunds made from the
 * Razorpay dashboard) — end in `applyRefund`, which is idempotent per Razorpay refund id and takes back
 * the pack's credits in proportion to the amount refunded (never more than the parent still has).
 */
@Injectable()
export class PaymentRefundsService {
  private readonly logger = new Logger(PaymentRefundsService.name);
  private _razorpay: Razorpay | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly influencersService: InfluencersService,
    @Optional() private readonly mail?: MailService,
  ) {}

  private get razorpay(): Razorpay {
    if (!this._razorpay) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) throw new BadRequestException('Razorpay keys are not configured');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RazorpayClass = require('razorpay') as typeof Razorpay;
      this._razorpay = new RazorpayClass({ key_id: keyId, key_secret: keySecret });
    }
    return this._razorpay;
  }

  async preview(orderId: string): Promise<RefundPreview> {
    const { order, purchase, paymentId } = await this.load(this.dataSource.manager, orderId);
    const user = await this.dataSource.getRepository(User).findOneOrFail({ where: { id: order.userId } });
    const granted = grantedBy(purchase);
    const alreadyRefunded = await this.refundedSoFar(this.dataSource.manager, paymentId);
    const paid = Number(order.totalAmount);
    const unused = {
      credits: Math.min(granted.credits, Math.max(0, user.credits)),
      refreshes: Math.min(granted.refreshes, Math.max(0, user.avatarRefreshTokens)),
      slots: user.characterSlotsTotal < 0 ? 0 : Math.min(granted.slots, Math.max(0, user.characterSlotsTotal - user.characterSlotsUsed)),
    };
    const totalGranted = granted.credits + granted.refreshes + granted.slots;
    const totalUnused = unused.credits + unused.refreshes + unused.slots;
    const maxRefund = round2(Math.max(0, paid - alreadyRefunded));
    const isRealPayment = !!paymentId && /^pay_[A-Za-z0-9]{10,}$/.test(paymentId);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId,
      refundable: isRealPayment && maxRefund > 0,
      reason: !isRealPayment
        ? 'This purchase was a test purchase without a real Razorpay payment, so there is nothing to refund.'
        : maxRefund <= 0 ? 'This payment has already been refunded in full.' : null,
      paid,
      alreadyRefunded,
      maxRefund,
      granted,
      unused,
      suggestedAmount: totalGranted ? Math.min(maxRefund, round2(paid * (totalUnused / totalGranted))) : maxRefund,
    };
  }

  /** Admin button: refund through Razorpay, then apply it here (the webhook for this refund is then a no-op). */
  async refund(orderId: string, amount: number, adminId: string | null, note?: string) {
    const p = await this.preview(orderId);
    if (!p.refundable) throw new BadRequestException(p.reason ?? 'This order cannot be refunded');
    const value = round2(Number(amount));
    if (!(value > 0) || value > p.maxRefund) {
      throw new BadRequestException(`Refund must be more than ₹0 and at most ₹${p.maxRefund}`);
    }
    let refund: { id: string; amount: number };
    try {
      refund = (await this.razorpay.payments.refund(p.paymentId!, {
        amount: Math.round(value * 100),
        speed: 'normal',
        notes: { orderNumber: p.orderNumber, by: 'admin' },
      })) as unknown as { id: string; amount: number };
    } catch (err) {
      const msg = (err as { error?: { description?: string } })?.error?.description ?? (err instanceof Error ? err.message : String(err));
      this.logger.warn(`Razorpay refund failed for ${p.orderNumber}: ${msg}`);
      throw new BadRequestException(`Razorpay refused the refund: ${msg}`);
    }
    return this.applyRefund(p.paymentId!, refund.id, refund.amount / 100, { adminId, note });
  }

  /**
   * Records a refund Razorpay has made: takes back the pack's unused credits in proportion, logs it in the
   * parent's history, updates the order, reverses influencer commission on a full refund, emails the parent.
   * Safe to call twice for the same refund id.
   */
  async applyRefund(paymentId: string, refundId: string, amount: number, opts: { adminId?: string | null; note?: string; source?: string } = {}) {
    const result = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [paymentId]);
      const existing = await manager.findOne(CreditTransaction, { where: { reason: CreditTransactionReason.PaymentRefund, referenceId: refundId } });
      if (existing) return null;

      const purchase = await manager.findOne(CreditTransaction, { where: { razorpayPaymentId: paymentId, reason: CreditTransactionReason.Purchase } });
      if (!purchase) {
        this.logger.warn(`Refund ${refundId} for unknown payment ${paymentId} — not a credit pack, ignored`);
        return null;
      }
      const order = await this.findOrder(manager, purchase);
      const user = await manager.findOne(User, { where: { id: purchase.userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) return null;

      const paid = Number(purchase.pricePaid ?? order?.totalAmount ?? amount);
      const share = paid > 0 ? Math.min(1, amount / paid) : 1;
      const granted = grantedBy(purchase);
      const take = {
        credits: Math.min(Math.round(granted.credits * share), Math.max(0, user.credits)),
        refreshes: Math.min(Math.round(granted.refreshes * share), Math.max(0, user.avatarRefreshTokens)),
        slots: user.characterSlotsTotal < 0 ? 0 : Math.min(Math.round(granted.slots * share), Math.max(0, user.characterSlotsTotal - user.characterSlotsUsed)),
      };
      user.credits -= take.credits;
      user.avatarRefreshTokens -= take.refreshes;
      if (user.characterSlotsTotal >= 0) user.characterSlotsTotal -= take.slots;
      await manager.save(user);

      await manager.save(manager.create(CreditTransaction, {
        userId: user.id,
        delta: -take.credits,
        avatarRefreshTokensDelta: -take.refreshes,
        characterSlotsDelta: -take.slots,
        reason: CreditTransactionReason.PaymentRefund,
        referenceId: refundId,
        packId: purchase.packId,
        packName: purchase.packName,
        pricePaid: round2(amount),
        razorpayOrderId: purchase.razorpayOrderId,
        razorpayPaymentId: paymentId,
      }));

      const refundedTotal = await this.refundedSoFar(manager, paymentId);
      const full = refundedTotal >= paid - 0.009;
      if (order) {
        const oldStatus = order.status;
        if (full) {
          order.status = CommerceOrderStatus.Refunded;
          await manager.save(order);
        }
        await manager.save(manager.create(OrderStatusHistory, {
          orderId: order.id,
          oldStatus,
          newStatus: order.status,
          note: `${full ? 'Refunded' : 'Partly refunded'} ₹${round2(amount)} via Razorpay (${refundId})` +
            `${opts.source === 'webhook' ? ' — from the Razorpay dashboard' : ''}; took back ${describeTake(take)}${opts.note ? ` — ${opts.note}` : ''}`,
          changedByUserId: opts.adminId ?? null,
        }));
      }
      return { order, user, take, full, amount: round2(amount) };
    });
    if (!result) return { applied: false };

    if (result.full && result.order) {
      await this.influencersService.reverseCommissionForOrder(result.order.id)
        .catch((err: unknown) => this.logger.warn(`Commission reversal for ${result.order!.orderNumber} failed: ${err instanceof Error ? err.message : String(err)}`));
    }
    if (this.mail && result.user.email) {
      void this.mail.send(refundIssuedEmail({
        to: result.user.email,
        parentName: result.user.name || 'there',
        orderNumber: result.order?.orderNumber ?? paymentId,
        amount: result.amount,
        takenBack: describeTake(result.take),
      })).catch((err: unknown) => this.logger.warn(`Refund email failed: ${err instanceof Error ? err.message : String(err)}`));
    }
    this.logger.log(`Refund ${refundId} applied: ₹${result.amount} for ${result.order?.orderNumber ?? paymentId}, took back ${describeTake(result.take)}`);
    return { applied: true, full: result.full, amount: result.amount, takenBack: result.take };
  }

  /** Razorpay webhook (refunds made in the Razorpay dashboard). Verifies the signature with RAZORPAY_WEBHOOK_SECRET. */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ ok: boolean }> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException('Webhook secret not configured');
    if (!rawBody || !signature) throw new BadRequestException('Missing signature');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new BadRequestException('Invalid signature');

    const event = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      payload?: { refund?: { entity?: { id: string; payment_id: string; amount: number; status?: string } } };
    };
    const refund = event.payload?.refund?.entity;
    if (refund && (event.event === 'refund.processed' || event.event === 'refund.created')) {
      await this.applyRefund(refund.payment_id, refund.id, refund.amount / 100, { source: 'webhook' });
    }
    return { ok: true };
  }

  private async load(manager: EntityManager, orderId: string) {
    const order = await manager.findOne(Order, { where: { id: orderId, isDeleted: false } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.orderType !== CommerceOrderType.CreditPurchase) {
      throw new BadRequestException('Only credit-pack purchases can be refunded here');
    }
    const fromNote = /Razorpay: (\S+)/.exec(order.adminNotes ?? '')?.[1] ?? null;
    let purchase = fromNote
      ? await manager.findOne(CreditTransaction, { where: { razorpayPaymentId: fromNote, reason: CreditTransactionReason.Purchase } })
      : null;
    if (!purchase) {
      // Notes edited by an admin — match the purchase recorded within a minute of the order, same user and amount.
      const rows = await manager.query(
        `SELECT id FROM credit_transactions WHERE "userId" = $1 AND reason = 'purchase' AND "pricePaid" = $2
           AND "createdAt" BETWEEN $3::timestamptz - interval '60 seconds' AND $3::timestamptz + interval '60 seconds'
         ORDER BY abs(extract(epoch FROM "createdAt" - $3::timestamptz)) LIMIT 1`,
        [order.userId, order.totalAmount, order.createdAt],
      );
      purchase = rows[0] ? await manager.findOne(CreditTransaction, { where: { id: rows[0].id } }) : null;
    }
    if (!purchase) throw new BadRequestException('Could not find the payment for this order');
    return { order, purchase, paymentId: purchase.razorpayPaymentId };
  }

  private async findOrder(manager: EntityManager, purchase: CreditTransaction): Promise<Order | null> {
    const byNote = await manager.query(
      `SELECT id FROM orders WHERE "orderType" = 'credit_purchase' AND "adminNotes" LIKE $1 LIMIT 1`,
      [`%Razorpay: ${purchase.razorpayPaymentId}%`],
    );
    if (byNote[0]) return manager.findOne(Order, { where: { id: byNote[0].id } });
    const rows = await manager.query(
      `SELECT id FROM orders WHERE "userId" = $1 AND "orderType" = 'credit_purchase' AND "totalAmount" = $2
         AND "createdAt" BETWEEN $3::timestamptz - interval '60 seconds' AND $3::timestamptz + interval '60 seconds' LIMIT 1`,
      [purchase.userId, purchase.pricePaid, purchase.createdAt],
    );
    return rows[0] ? manager.findOne(Order, { where: { id: rows[0].id } }) : null;
  }

  private async refundedSoFar(manager: EntityManager, paymentId: string | null): Promise<number> {
    if (!paymentId) return 0;
    const [{ total }] = await manager.query(
      `SELECT COALESCE(SUM("pricePaid"), 0)::float AS total FROM credit_transactions WHERE reason = 'payment_refund' AND "razorpayPaymentId" = $1`,
      [paymentId],
    );
    return round2(Number(total));
  }
}

function grantedBy(purchase: CreditTransaction) {
  return {
    credits: Math.max(0, purchase.delta),
    refreshes: Math.max(0, purchase.avatarRefreshTokensDelta ?? 0),
    slots: Math.max(0, purchase.characterSlotsDelta ?? 0),
  };
}

function describeTake(t: { credits: number; refreshes: number; slots: number }): string {
  const parts: string[] = [];
  if (t.credits) parts.push(`${t.credits} story credit${t.credits === 1 ? '' : 's'}`);
  if (t.refreshes) parts.push(`${t.refreshes} Avatar Refresh${t.refreshes === 1 ? '' : 'es'}`);
  if (t.slots) parts.push(`${t.slots} character slot${t.slots === 1 ? '' : 's'}`);
  return parts.join(', ') || 'nothing';
}

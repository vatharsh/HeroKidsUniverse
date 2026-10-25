import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { DataSource, In } from 'typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { isSandboxFor } from '../common/sandbox';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { MailService } from '../mail/mail.service';
import { webPublicUrl } from '../mail/story-ready-email';
import { CommerceOrderType, Order } from '../merchandise/orders/order.entity';
import { Story } from '../stories/story.entity';
import { User } from '../users/user.entity';
import { SupportReason, SupportRequest, SupportStatus } from './support-request.entity';

const REASONS: Record<SupportReason, string> = {
  credits_missing: 'Charged but credits didn’t arrive',
  charged_twice: 'Charged twice',
  story_wrong: 'A story came out wrong',
  other: 'Something else',
};
const STATUS_TEXT: Record<SupportStatus, string> = {
  open: 'Received — we reply within 2 working days',
  credited: 'Credit returned',
  refunded: 'Refunded',
  declined: 'Closed',
  resolved: 'Resolved',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly mail?: MailService,
  ) {}

  async create(userId: string, body: { orderId?: string; storyId?: string; reason?: string; message?: string }) {
    const reason = body.reason as SupportReason;
    if (!REASONS[reason]) throw new BadRequestException('Please pick what went wrong');
    const message = (body.message ?? '').trim().slice(0, 1000);
    if (message.length < 5) throw new BadRequestException('Please tell us a little about what happened');

    const order = body.orderId ? await this.dataSource.getRepository(Order).findOne({ where: { id: body.orderId, userId, isDeleted: false } }) : null;
    if (body.orderId && !order) throw new NotFoundException('Order not found');
    const story = body.storyId ? await this.dataSource.getRepository(Story).findOne({ where: { id: body.storyId, userId } }) : null;
    if (body.storyId && !story) throw new NotFoundException('Story not found');
    if (reason === 'story_wrong' && !story) throw new BadRequestException('Please pick the story that came out wrong');

    const repo = this.dataSource.getRepository(SupportRequest);
    const already = await repo.findOne({
      where: [
        ...(order ? [{ userId, orderId: order.id, status: 'open' as SupportStatus }] : []),
        ...(story ? [{ userId, storyId: story.id, status: 'open' as SupportStatus }] : []),
      ],
    });
    if (already) throw new ConflictException('We already have your request about this and will reply within 2 working days.');
    const [{ n }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM support_requests WHERE "userId" = $1 AND "createdAt" > now() - interval '1 day'`,
      [userId],
    );
    if (n >= 5) throw new BadRequestException('You’ve sent several requests today — we’ll reply to those first. For anything urgent, email support@herokidsuniverse.com.');

    const request = await repo.save(repo.create({
      userId,
      orderId: order?.id ?? null,
      storyId: story?.id ?? null,
      reason,
      message,
      status: 'open',
      isSandbox: await isSandboxFor(this.dataSource, userId),
    }));

    const user = await this.dataSource.getRepository(User).findOneOrFail({ where: { id: userId } });
    void this.notifyAdmin(request, user, order, story);
    void this.send(user.email, `We got your request — ${REASONS[reason]}`,
      `Hi ${user.name || 'there'}, thanks for letting us know. We'll look into it and reply within 2 working days.`,
      `Your message: “${message}”`);
    return this.serialize(request);
  }

  /** The parent's own requests, for showing status on orders and stories. */
  async mine(userId: string) {
    const rows = await this.dataSource.getRepository(SupportRequest).find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
    return rows.map((r) => this.serialize(r));
  }

  async adminList(status?: string) {
    const where = status && status !== 'all' ? { status: status as SupportStatus } : {};
    const rows = await this.dataSource.getRepository(SupportRequest).find({ where, order: { createdAt: 'DESC' }, take: 200 });
    const users = await this.dataSource.getRepository(User).find({ where: { id: In([...new Set(rows.map((r) => r.userId))]) }, select: { id: true, name: true, email: true, credits: true } });
    const orders = await this.dataSource.getRepository(Order).find({ where: { id: In(rows.map((r) => r.orderId).filter(Boolean) as string[]) } });
    const stories = await this.dataSource.getRepository(Story).find({ where: { id: In(rows.map((r) => r.storyId).filter(Boolean) as string[]) }, select: { id: true, title: true, isPreview: true, status: true, createdAt: true } });
    const [{ open }] = await this.dataSource.query(`SELECT COUNT(*)::int AS open FROM support_requests WHERE status = 'open'`);
    return {
      open,
      items: rows.map((r) => {
        const o = orders.find((x) => x.id === r.orderId);
        const s = stories.find((x) => x.id === r.storyId);
        return {
          ...this.serialize(r),
          user: users.find((u) => u.id === r.userId) ?? null,
          order: o ? { id: o.id, orderNumber: o.orderNumber, total: Number(o.totalAmount), status: o.status, isCreditPack: o.orderType === CommerceOrderType.CreditPurchase } : null,
          story: s ? { id: s.id, title: s.title, isPreview: s.isPreview, status: s.status, createdAt: s.createdAt } : null,
        };
      }),
    };
  }

  /**
   * Closes a request. 'credit' returns the story's credit (a free story for a preview) — only once per story;
   * 'refunded' just records that money was refunded from the order's Refund panel (that sends its own email).
   */
  async resolve(id: string, adminId: string, body: { action?: string; reply?: string }) {
    const action = body.action as 'credit' | 'refunded' | 'declined' | 'resolved';
    if (!['credit', 'refunded', 'declined', 'resolved'].includes(action)) throw new BadRequestException('Unknown action');
    const reply = (body.reply ?? '').trim().slice(0, 1000);
    if (action === 'declined' && reply.length < 5) throw new BadRequestException('Tell the parent why — add a short reply');

    const result = await this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(SupportRequest, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!request) throw new NotFoundException('Request not found');
      if (request.status !== 'open') throw new ConflictException('This request is already closed');

      let creditNote = '';
      if (action === 'credit') {
        if (!request.storyId) throw new BadRequestException('There is no story on this request to credit back');
        const story = await manager.findOne(Story, { where: { id: request.storyId } });
        if (!story) throw new NotFoundException('Story not found');
        // A story's credit comes back once: automatic failure refunds and earlier credit-backs both count.
        const [{ refunds }] = await manager.query(
          `SELECT COUNT(*)::int AS refunds FROM credit_transactions WHERE "referenceId" = $1 AND "userId" = $2 AND reason = 'refund'`,
          [story.id, request.userId],
        );
        if (refunds > 0) throw new ConflictException('This story’s credit was already returned');
        const user = await manager.findOneOrFail(User, { where: { id: request.userId }, lock: { mode: 'pessimistic_write' } });
        const back = story.isPreview ? 0 : Math.max(1, story.creditsUsed || 0);
        if (story.isPreview) {
          user.previewCredits += 1;
          creditNote = 'Your free story is back — you can make a new one any time.';
        } else {
          user.credits += back;
          creditNote = `${back} story credit${back === 1 ? ' is' : 's are'} back in your account.`;
        }
        await manager.save(user);
        await manager.save(manager.create(CreditTransaction, {
          userId: user.id,
          delta: back,
          reason: CreditTransactionReason.Refund,
          referenceId: story.id,
        }));
      }

      request.status = action === 'credit' ? 'credited' : action;
      request.adminReply = reply || null;
      request.resolvedBy = adminId;
      request.resolvedAt = new Date();
      await manager.save(request);
      return { request, creditNote };
    });

    if (action !== 'refunded') {
      const user = await this.dataSource.getRepository(User).findOne({ where: { id: result.request.userId } });
      if (user) {
        const subject = action === 'credit' ? 'We’ve returned your credit' : action === 'declined' ? 'About your request' : 'Your request is resolved';
        void this.send(user.email, subject, [`Hi ${user.name || 'there'},`, result.creditNote, reply].filter(Boolean).join(' '), '');
      }
    }
    return this.serialize(result.request);
  }

  private serialize(r: SupportRequest) {
    return {
      id: r.id,
      orderId: r.orderId,
      storyId: r.storyId,
      reason: r.reason,
      reasonText: REASONS[r.reason],
      message: r.message,
      status: r.status,
      statusText: STATUS_TEXT[r.status],
      adminReply: r.adminReply,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
    };
  }

  private async notifyAdmin(r: SupportRequest, user: User, order: Order | null, story: Story | null) {
    const row = await this.dataSource.getRepository(PlatformSetting).findOne({ where: { key: 'ALERT_EMAIL' } });
    const to = row?.value?.trim() || 'support@herokidsuniverse.com';
    const lines = [
      `${REASONS[r.reason]} — from ${user.name || 'a parent'} (${user.email})`,
      order ? `Order ${order.orderNumber} · ₹${Number(order.totalAmount)} · ${order.status}` : '',
      story ? `Story: ${story.title ?? 'Untitled'}${story.isPreview ? ' (free preview)' : ''}` : '',
      `Their balance: ${user.credits} credits`,
      `Message: “${r.message}”`,
    ].filter(Boolean);
    await this.send(to, `🧾 Help request: ${REASONS[r.reason]}${order ? ` — ${order.orderNumber}` : ''}`, lines.join('\n'), '', `${webPublicUrl()}/admin/support`, 'Open in admin');
  }

  private async send(to: string | null | undefined, subject: string, body: string, extra: string, link?: string, linkText?: string) {
    if (!this.mail || !to) return;
    const html = `<!doctype html><html><body style="margin:0;background:#f6f3ff;font-family:Arial,Helvetica,sans-serif;color:#1e1b4b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#6d28d9">HeroKids Universe</td></tr>
<tr><td style="padding-top:14px;font-size:15px;line-height:22px;white-space:pre-line">${esc(body)}</td></tr>
${extra ? `<tr><td style="padding-top:10px;font-size:13px;line-height:20px;color:#6b7280">${esc(extra)}</td></tr>` : ''}
${link ? `<tr><td align="center" style="padding:22px 0 4px"><a href="${link}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:999px">${esc(linkText ?? 'Open')}</a></td></tr>` : ''}
<tr><td style="padding-top:14px;font-size:12px;color:#6b7280">support@herokidsuniverse.com</td></tr>
</table></td></tr></table></body></html>`;
    await this.mail.send({ to, subject, text: `${body}\n${extra}\n${link ?? ''}`.trim(), html })
      .catch((err: unknown) => this.logger.warn(`Support email failed: ${err instanceof Error ? err.message : String(err)}`));
  }
}

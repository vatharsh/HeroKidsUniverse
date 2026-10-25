import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, LessThan, Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { maintenanceState } from '../common/maintenance';
import { MailService } from '../mail/mail.service';
import { previewWaitlistEmail } from '../mail/preview-waitlist-email';
import { User } from '../users/user.entity';
import { PreviewWaitlist } from './preview-waitlist.entity';

/** Start of "today" in India, as a UTC timestamp — the daily quota resets at midnight IST. */
const IST_DAY_START_SQL = `(date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
const HOUR = 60 * 60 * 1000;

/**
 * Daily cap on free preview stories (FREE_PREVIEW_DAILY_LIMIT, 0 = no cap) so a viral day costs a known
 * amount. Parents turned away go on a waiting list and are emailed once free stories open up again.
 */
@Injectable()
export class PreviewQuotaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PreviewQuotaService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PreviewWaitlist) private readonly waitlistRepo: Repository<PreviewWaitlist>,
    @Optional() private readonly mail?: MailService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.notifyWaitlist(), HOUR);
    setTimeout(() => void this.notifyWaitlist(), 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async dailyLimit(): Promise<number> {
    const row = await this.dataSource.getRepository(PlatformSetting).findOne({ where: { key: 'FREE_PREVIEW_DAILY_LIMIT' } });
    const value = Number(row?.value ?? SETTING_DEFAULTS.FREE_PREVIEW_DAILY_LIMIT.value);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  async previewsToday(manager: EntityManager = this.dataSource.manager): Promise<number> {
    const [{ n }] = await manager.query(
      `SELECT COUNT(*)::int AS n FROM stories WHERE "isPreview" = true AND status <> 'failed' AND "createdAt" >= ${IST_DAY_START_SQL}`,
    );
    return n;
  }

  /**
   * Called inside the story transaction just before a free preview is charged. Serialised with an
   * advisory lock so a rush of sign-ups can't overshoot the cap. Throws (and waitlists) when it's full.
   */
  async assertPreviewAvailable(manager: EntityManager, user: User): Promise<void> {
    const limit = await this.dailyLimit();
    if (!limit || user.role === 'admin') return;
    await manager.query('SELECT pg_advisory_xact_lock(724001)');
    if ((await this.previewsToday(manager)) < limit) return;
    // Outside the story transaction — that one rolls back when we refuse, and the entry must stay.
    await this.dataSource.query(
      `INSERT INTO preview_waitlist ("userId") VALUES ($1) ON CONFLICT ("userId") DO UPDATE SET "notifiedAt" = NULL`,
      [user.id],
    );
    throw new HttpException(
      "Today's free stories are all given out. We're a small, independent team and every story costs us real money to make, so we can only give away a few each day. Your free story is saved — come back tomorrow and we'll email you when it's ready. Can't wait? Make a full story now from your Top Up.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** Once they've made their free story, they're off the list. */
  async clearWaitlist(manager: EntityManager, userId: string): Promise<void> {
    await manager.delete(PreviewWaitlist, { userId });
  }

  async waitlistCounts(): Promise<{ waiting: number; addedToday: number }> {
    const [{ waiting, today }] = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE "notifiedAt" IS NULL)::int AS waiting,
              COUNT(*) FILTER (WHERE "createdAt" >= ${IST_DAY_START_SQL})::int AS today
         FROM preview_waitlist`,
    );
    return { waiting, addedToday: today };
  }

  /**
   * Hourly: email people turned away on an earlier day, as many as today's remaining free stories
   * allow (oldest first), so the emails never promise more stories than the cap.
   */
  async notifyWaitlist(): Promise<void> {
    if (!this.mail) return;
    try {
      // Don't invite people back to create a story while creating is paused.
      if ((await maintenanceState(this.dataSource)).on) return;
      const limit = await this.dailyLimit();
      const room = limit ? limit - (await this.previewsToday()) : 500;
      if (room <= 0) return;
      const [{ start }] = await this.dataSource.query(`SELECT ${IST_DAY_START_SQL} AS start`);
      const due = await this.waitlistRepo.find({
        where: { notifiedAt: IsNull(), createdAt: LessThan(new Date(start)) },
        order: { createdAt: 'ASC' },
        take: Math.min(room, 500),
      });
      for (const entry of due) {
        const user = await this.dataSource.getRepository(User).findOne({ where: { id: entry.userId } });
        if (user?.email && user.previewCredits > 0) {
          await this.mail.send(previewWaitlistEmail({ to: user.email, parentName: user.name || 'there' }))
            .catch((err: unknown) => this.logger.warn(`Waitlist email to ${entry.userId} failed: ${err instanceof Error ? err.message : String(err)}`));
        }
        await this.waitlistRepo.update(entry.id, { notifiedAt: new Date() });
      }
      if (due.length) this.logger.log(`Emailed ${due.length} parent(s) on the free-preview waiting list`);
    } catch (err) {
      this.logger.warn(`Waitlist check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

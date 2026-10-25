import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { MailService } from '../mail/mail.service';
import { webPublicUrl } from '../mail/story-ready-email';

/** Start of today / this month in India, as UTC timestamps — limits and alerts reset at midnight IST. */
const IST_DAY_START_SQL = `(date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
const IST_MONTH_START_SQL = `(date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
const HOUR = 60 * 60 * 1000;

/** Hidden settings row remembering which alerts already went out, so each is sent once per day/month. */
const ALERT_STATE_KEY = 'COST_ALERT_STATE';

export const DAILY_LIMIT_MESSAGE =
  "We're making a lot of stories right now and have paused new ones for today to keep things running smoothly. " +
  'Nothing was charged — please try again tomorrow.';

type AlertKind = 'daily_warning' | 'daily_limit' | 'monthly_warning' | 'monthly_limit';

/**
 * Live AI spend safety net: blocks new stories once today's spend reaches AI_DAILY_COST_HARD_LIMIT_USD
 * and emails ALERT_EMAIL when spend crosses the warning or limit levels (once per day / month each).
 * Test (sandbox) usage never counts.
 */
@Injectable()
export class AiSpendGuardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiSpendGuardService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly mail?: MailService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.checkAndAlert(), HOUR);
    setTimeout(() => void this.checkAndAlert(), 90_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async spend(): Promise<{ today: number; month: number }> {
    const [row] = await this.dataSource.query(
      `SELECT COALESCE(SUM("estimatedCostUsd") FILTER (WHERE "createdAt" >= ${IST_DAY_START_SQL}), 0)::float AS today,
              COALESCE(SUM("estimatedCostUsd"), 0)::float AS month
         FROM ai_usage_logs
        WHERE "isSandbox" = false AND "createdAt" >= ${IST_MONTH_START_SQL}`,
    );
    return { today: Number(row?.today ?? 0), month: Number(row?.month ?? 0) };
  }

  async isDailyLimitReached(): Promise<boolean> {
    const limit = await this.setting('AI_DAILY_COST_HARD_LIMIT_USD');
    if (!(limit > 0)) return false;
    const { today, month } = await this.spend();
    if (today < limit) return false;
    void this.alert('daily_limit', today, month);
    return true;
  }

  /** Called before a live story is charged, so parents are turned away with nothing taken. */
  async assertCanStartStory(): Promise<void> {
    if (await this.isDailyLimitReached()) {
      throw new HttpException(DAILY_LIMIT_MESSAGE, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** Hourly: email when today's or this month's spend crosses a warning or limit level. */
  async checkAndAlert(): Promise<void> {
    try {
      const [dailyWarn, dailyLimit, monthlyWarn, monthlyLimit] = await Promise.all([
        this.setting('AI_DAILY_COST_WARNING_USD'),
        this.setting('AI_DAILY_COST_HARD_LIMIT_USD'),
        this.setting('AI_MONTHLY_COST_WARNING_USD'),
        this.setting('AI_MONTHLY_COST_HARD_LIMIT_USD'),
      ]);
      const { today, month } = await this.spend();
      if (dailyLimit > 0 && today >= dailyLimit) await this.alert('daily_limit', today, month);
      else if (dailyWarn > 0 && today >= dailyWarn) await this.alert('daily_warning', today, month);
      if (monthlyLimit > 0 && month >= monthlyLimit) await this.alert('monthly_limit', today, month);
      else if (monthlyWarn > 0 && month >= monthlyWarn) await this.alert('monthly_warning', today, month);
    } catch (err) {
      this.logger.warn(`Cost alert check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async alert(kind: AlertKind, today: number, month: number): Promise<void> {
    const [{ day, mon }] = await this.dataSource.query(
      `SELECT to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS mon`,
    );
    const period: string = kind.startsWith('daily') ? day : mon;
    const repo = this.dataSource.getRepository(PlatformSetting);
    const row = await repo.findOne({ where: { key: ALERT_STATE_KEY } });
    const state = safeJson(row?.value);
    if (state[kind] === period) return;
    state[kind] = period;
    await repo.save({ key: ALERT_STATE_KEY, value: JSON.stringify(state), type: 'string', description: 'Internal: cost alerts already sent (not editable)' });

    this.logger.warn(`AI cost alert (${kind}): today $${today.toFixed(2)}, this month $${month.toFixed(2)}`);
    const to = (await this.stringSetting('ALERT_EMAIL')).trim();
    if (!this.mail || !to) return;
    const [rate, dailyLimit, monthlyLimit] = await Promise.all([
      this.setting('USD_INR_RATE'), this.setting('AI_DAILY_COST_HARD_LIMIT_USD'), this.setting('AI_MONTHLY_COST_HARD_LIMIT_USD'),
    ]);
    await this.mail.send(costAlertEmail({ to, kind, today, month, rate, dailyLimit, monthlyLimit }))
      .catch((err: unknown) => this.logger.warn(`Cost alert email failed: ${err instanceof Error ? err.message : String(err)}`));
  }

  private async setting(key: keyof typeof SETTING_DEFAULTS): Promise<number> {
    const value = Number(await this.stringSetting(key));
    return Number.isFinite(value) ? value : 0;
  }

  private async stringSetting(key: keyof typeof SETTING_DEFAULTS): Promise<string> {
    const row = await this.dataSource.getRepository(PlatformSetting).findOne({ where: { key } });
    return row?.value ?? SETTING_DEFAULTS[key]?.value ?? '';
  }
}

function safeJson(value: string | undefined): Record<string, string> {
  try {
    const parsed = JSON.parse(value ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const ALERT_TEXT: Record<AlertKind, { subject: string; line: string }> = {
  daily_warning: { subject: "⚠️ Today's AI spend passed your warning level", line: "Today's AI spend has passed your daily warning level. Stories are still being made." },
  daily_limit: { subject: '🛑 Daily AI limit reached — new stories paused', line: "Today's AI spend reached your daily limit, so new stories are paused until midnight (India time). Parents see a friendly message and are not charged." },
  monthly_warning: { subject: "⚠️ This month's AI spend passed your warning level", line: "This month's AI spend has passed your monthly warning level." },
  monthly_limit: { subject: "⚠️ This month's AI spend passed your monthly limit", line: "This month's AI spend has passed your monthly limit. Stories are not paused for the monthly limit — check whether this is real demand or something unusual." },
};

function costAlertEmail(p: {
  to: string; kind: AlertKind; today: number; month: number; rate: number; dailyLimit: number; monthlyLimit: number;
}) {
  const inr = (usd: number) => `₹${Math.round(usd * (p.rate || 0)).toLocaleString('en-IN')}`;
  const usd = (n: number) => `$${n.toFixed(2)}`;
  const { subject, line } = ALERT_TEXT[p.kind];
  const link = `${webPublicUrl()}/admin/settings`;
  const rows = [
    ['Today', `${usd(p.today)} (${inr(p.today)})`, p.dailyLimit > 0 ? `limit ${usd(p.dailyLimit)}` : ''],
    ['This month', `${usd(p.month)} (${inr(p.month)})`, p.monthlyLimit > 0 ? `limit ${usd(p.monthlyLimit)}` : ''],
  ];
  return {
    to: p.to,
    subject: `${subject} — HeroKids`,
    text: `${line}\n\n${rows.map((r) => `${r[0]}: ${r[1]} ${r[2]}`).join('\n')}\n\nChange the limits in Admin → Settings → Cost safety:\n${link}`,
    html: `<!doctype html><html><body style="margin:0;background:#f6f3ff;font-family:Arial,Helvetica,sans-serif;color:#1e1b4b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:18px;font-weight:bold;color:#6d28d9">HeroKids Universe · AI cost alert</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:22px">${line}</td></tr>
<tr><td style="padding-top:16px"><table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;border-collapse:collapse">
${rows.map((r) => `<tr><td style="border-top:1px solid #eee;color:#6b7280">${r[0]}</td><td style="border-top:1px solid #eee;font-weight:bold">${r[1]}</td><td style="border-top:1px solid #eee;color:#6b7280;text-align:right">${r[2]}</td></tr>`).join('')}
</table></td></tr>
<tr><td align="center" style="padding-top:22px"><a href="${link}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:999px">Open cost settings</a></td></tr>
</table></td></tr></table></body></html>`,
  };
}

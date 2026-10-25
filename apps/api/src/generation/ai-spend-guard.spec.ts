import { HttpException, HttpStatus } from '@nestjs/common';
import type { DataSource } from 'typeorm';

import type { MailService } from '../mail/mail.service';
import { AiSpendGuardService, DAILY_LIMIT_MESSAGE } from './ai-spend-guard.service';

/** Fake DataSource: fixed spend numbers and an in-memory platform_settings table. */
function setup(spend: { today: number; month: number }, settings: Record<string, string> = {}) {
  const rows = new Map(Object.entries(settings).map(([key, value]) => [key, { key, value }]));
  const dataSource = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('estimatedCostUsd')) return [spend];
      if (sql.includes('to_char')) return [{ day: '2026-10-25', mon: '2026-10' }];
      return [];
    }),
    getRepository: () => ({
      findOne: async ({ where: { key } }: { where: { key: string } }) => rows.get(key) ?? null,
      save: async (row: { key: string; value: string }) => rows.set(row.key, row),
    }),
  } as unknown as DataSource;
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const guard = new AiSpendGuardService(dataSource, mail as unknown as MailService);
  return { guard, mail };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('AiSpendGuardService', () => {
  it('lets stories through under the daily limit', async () => {
    const { guard, mail } = setup({ today: 10, month: 50 }, { AI_DAILY_COST_HARD_LIMIT_USD: '60' });
    await expect(guard.assertCanStartStory()).resolves.toBeUndefined();
    await flush();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('turns new stories away with a friendly 503 at the limit, and emails once a day', async () => {
    const { guard, mail } = setup({ today: 61, month: 300 }, { AI_DAILY_COST_HARD_LIMIT_USD: '60' });
    const err = await guard.assertCanStartStory().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect((err as HttpException).message).toBe(DAILY_LIMIT_MESSAGE);
    await flush();
    await guard.assertCanStartStory().catch(() => undefined);
    await flush();
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe('support@herokidsuniverse.com');
    expect(mail.send.mock.calls[0][0].subject).toMatch(/Daily AI limit reached/);
  });

  it('a limit of 0 never blocks', async () => {
    const { guard } = setup({ today: 999, month: 999 }, { AI_DAILY_COST_HARD_LIMIT_USD: '0' });
    await expect(guard.isDailyLimitReached()).resolves.toBe(false);
  });

  it('hourly check emails the daily and monthly warnings once each', async () => {
    const { guard, mail } = setup(
      { today: 12, month: 250 },
      { AI_DAILY_COST_WARNING_USD: '10', AI_DAILY_COST_HARD_LIMIT_USD: '60', AI_MONTHLY_COST_WARNING_USD: '200', AI_MONTHLY_COST_HARD_LIMIT_USD: '500' },
    );
    await guard.checkAndAlert();
    await guard.checkAndAlert();
    const subjects = mail.send.mock.calls.map((c) => c[0].subject as string);
    expect(subjects).toHaveLength(2);
    expect(subjects[0]).toMatch(/Today's AI spend passed/);
    expect(subjects[1]).toMatch(/This month's AI spend passed your warning/);
  });

  it('sends nothing when the alert email is empty', async () => {
    const { guard, mail } = setup({ today: 12, month: 0 }, { AI_DAILY_COST_WARNING_USD: '10', ALERT_EMAIL: '' });
    await guard.checkAndAlert();
    expect(mail.send).not.toHaveBeenCalled();
  });
});

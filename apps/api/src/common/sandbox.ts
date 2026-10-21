import { DataSource } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { User } from '../users/user.entity';

/**
 * Whether new records count as test data ("sandbox") or real business ("live").
 *
 * - SANDBOX_MODE (platform setting) is the launch switch: ON before launch, so everything is test;
 *   turn it OFF at launch and everything from then on is live.
 * - Users marked as test accounts (admin → Users) always create test data, even after launch.
 *
 * Records are labelled once, when they are created. Flipping the switch never relabels history.
 */
export async function isGlobalSandbox(dataSource: DataSource): Promise<boolean> {
  const row = await dataSource.getRepository(PlatformSetting).findOne({ where: { key: 'SANDBOX_MODE' } });
  return (row?.value ?? SETTING_DEFAULTS.SANDBOX_MODE.value) === 'true';
}

export async function isSandboxFor(dataSource: DataSource, userId?: string | null): Promise<boolean> {
  if (await isGlobalSandbox(dataSource)) return true;
  if (!userId) return false;
  const user = await dataSource.getRepository(User).findOne({ where: { id: userId }, select: { id: true, isTestAccount: true } });
  return !!user?.isTestAccount;
}

/** Which Razorpay keys the server is using — shown next to the launch switch so the two can't drift apart. */
export function razorpayKeyMode(): 'live' | 'test' | 'missing' {
  const key = process.env.RAZORPAY_KEY_ID ?? '';
  if (!key) return 'missing';
  return key.startsWith('rzp_live_') ? 'live' : 'test';
}

import { Repository } from 'typeorm';

import {
  PlatformSetting,
  SETTING_DEFAULTS,
} from '../admin/platform-setting.entity';
import { MailService } from '../mail/mail.service';

/**
 * Verification is enforced only when we can actually deliver the code: in production that means SMTP is
 * configured (so nobody is locked out before email is set up); in development codes are logged instead.
 */
export async function isEmailVerificationRequired(
  settings: Repository<PlatformSetting>,
  mail: MailService,
): Promise<boolean> {
  const row = await settings
    .findOne({ where: { key: 'EMAIL_VERIFICATION_REQUIRED' } })
    .catch(() => null);
  const enabled =
    (row?.value ?? SETTING_DEFAULTS.EMAIL_VERIFICATION_REQUIRED.value) !==
    'false';
  return (
    enabled && (mail.isConfigured() || process.env.NODE_ENV !== 'production')
  );
}

/** Only parent accounts verify by email; admin and influencer logins are created by us. */
export function needsEmailVerification(role: string | undefined): boolean {
  return !role || role === 'parent';
}

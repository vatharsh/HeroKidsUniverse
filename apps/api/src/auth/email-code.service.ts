import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';

import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { EmailCode, EmailCodePurpose } from './email-code.entity';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

/** Issues and checks the 6-digit codes we email for sign-up verification and password resets. */
@Injectable()
export class EmailCodeService {
  private readonly logger = new Logger(EmailCodeService.name);

  constructor(
    @InjectRepository(EmailCode)
    private readonly codesRepo: Repository<EmailCode>,
    private readonly mail: MailService,
  ) {}

  async send(
    user: User,
    purpose: EmailCodePurpose,
  ): Promise<{ resendInSeconds: number }> {
    const recent = await this.codesRepo.find({
      where: {
        userId: user.id,
        purpose,
        createdAt: MoreThan(new Date(Date.now() - 60 * 60 * 1000)),
      },
      order: { createdAt: 'DESC' },
    });
    const last = recent[0];
    if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000,
      );
      throw new HttpException(
        `Please wait ${wait} seconds before asking for another code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (recent.length >= MAX_CODES_PER_HOUR) {
      throw new HttpException(
        'Too many codes requested. Please try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Only one live code at a time: older ones stop working when a new one is sent.
    await this.codesRepo.update(
      { userId: user.id, purpose, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );
    await this.codesRepo.save(
      this.codesRepo.create({
        userId: user.id,
        purpose,
        codeHash: this.hash(user.id, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      }),
    );

    await this.mail.send({
      to: user.email,
      ...(purpose === 'verify_email'
        ? verifyEmail(user.name, code)
        : resetEmail(user.name, code)),
    });
    this.logger.log(`Sent ${purpose} code to user ${user.id}`);
    return { resendInSeconds: RESEND_COOLDOWN_MS / 1000 };
  }

  /** Throws a friendly 400 unless the code is the live, unexpired one; consumes it on success. */
  async consume(
    user: User,
    purpose: EmailCodePurpose,
    code: string,
  ): Promise<void> {
    const live = await this.codesRepo.findOne({
      where: { userId: user.id, purpose, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!live || live.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'This code has expired. Please ask for a new one.',
      );
    }
    if (live.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Too many wrong tries. Please ask for a new code.',
      );
    }
    if (live.codeHash !== this.hash(user.id, code.trim())) {
      await this.codesRepo.increment({ id: live.id }, 'attempts', 1);
      const left = MAX_ATTEMPTS - live.attempts - 1;
      throw new BadRequestException(
        left > 0
          ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.`
          : 'Too many wrong tries. Please ask for a new code.',
      );
    }
    await this.codesRepo.update({ id: live.id }, { consumedAt: new Date() });
  }

  private hash(userId: string, code: string): string {
    return createHash('sha256').update(`${userId}:${code}`).digest('hex');
  }
}

function layout(heading: string, intro: string, code: string, outro: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ff;font-family:Arial,Helvetica,sans-serif;color:#1e1b4b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:bold;color:#6d28d9">HeroKids Universe</td></tr>
<tr><td style="padding-top:16px;font-size:18px;font-weight:bold">${heading}</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:22px">${intro}</td></tr>
<tr><td align="center" style="padding:24px 0"><div style="display:inline-block;font-size:32px;letter-spacing:8px;font-weight:bold;background:#f3e8ff;color:#4c1d95;padding:12px 20px;border-radius:12px">${code}</div></td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#6b7280">${outro}</td></tr>
</table></td></tr></table></body></html>`;
  return html;
}

function verifyEmail(name: string, code: string) {
  return {
    subject: `${code} is your HeroKids Universe code`,
    text: `Hi ${name},\n\nYour HeroKids Universe verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't create an account, you can ignore this email.`,
    html: layout(
      'Confirm your email',
      `Hi ${escapeHtml(name)}, enter this code to finish creating your account:`,
      code,
      "The code expires in 10 minutes. If you didn't create an account, you can ignore this email.",
    ),
  };
}

function resetEmail(name: string, code: string) {
  return {
    subject: `${code} is your HeroKids Universe password reset code`,
    text: `Hi ${name},\n\nYour password reset code is ${code}. It expires in 10 minutes.\n\nIf you didn't ask to reset your password, you can ignore this email — your password stays the same.`,
    html: layout(
      'Reset your password',
      `Hi ${escapeHtml(name)}, enter this code to choose a new password:`,
      code,
      "The code expires in 10 minutes. If you didn't ask for this, you can ignore this email — your password stays the same.",
    ),
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] as string,
  );
}

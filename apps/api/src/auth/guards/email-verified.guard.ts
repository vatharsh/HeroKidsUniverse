import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

import { PlatformSetting } from '../../admin/platform-setting.entity';
import { MailService } from '../../mail/mail.service';
import { ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator';
import type { CurrentUserPayload } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  isEmailVerificationRequired,
  needsEmailVerification,
} from '../email-verification-policy';

/** Runs after JwtAuthGuard: a parent must verify their email before using anything else. */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly mail: MailService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;
    if (
      this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, targets)
    )
      return true;

    const user = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUserPayload }>().user;
    if (!user || user.emailVerified || !needsEmailVerification(user.role))
      return true;
    if (
      !(await isEmailVerificationRequired(
        this.dataSource.getRepository(PlatformSetting),
        this.mail,
      ))
    )
      return true;

    throw new ForbiddenException({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address to continue.',
    });
  }
}

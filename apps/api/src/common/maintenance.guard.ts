import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { maintenanceMessage, maintenanceState } from './maintenance';

/**
 * While MAINTENANCE_MODE is on, parents can still read everything, sign in and manage their account,
 * but anything that creates or buys is paused. Admins are never blocked. Payments already in progress
 * still complete, so nobody pays without getting their credits.
 */
const ALWAYS_ALLOWED = [
  /\/auth\/(login|refresh|logout|verify-email|verify-email\/resend|forgot-password|reset-password)$/,
  /\/credits\/packs\/[^/]+\/purchase\/verify$/,
  /\/payments\/razorpay\/webhook$/,
  /\/support\/requests$/,
  /\/users\/me(\/.*)?$/,
];

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<{ method: string; path?: string; url: string; user?: CurrentUserPayload }>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (req.user?.role === 'admin') return true;
    const path = (req.path ?? req.url.split('?')[0]).replace(/\/+$/, '');
    if (ALWAYS_ALLOWED.some((re) => re.test(path))) return true;

    const state = await maintenanceState(this.dataSource);
    if (!state.on) return true;
    throw new HttpException(maintenanceMessage(state), HttpStatus.SERVICE_UNAVAILABLE);
  }
}

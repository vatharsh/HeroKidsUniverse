import { BadRequestException, Body, Controller, Get, Patch, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { InfluencersService } from './influencers.service';
import { UsersService } from '../users/users.service';

@Controller('influencer')
@Roles('influencer')
export class InfluencerPortalController {
  constructor(
    private readonly influencersService: InfluencersService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  me(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.influencersService.getPortalMe(currentUser.id);
  }

  @Patch('notes')
  updateNotes(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() body: { notes?: string | null },
  ) {
    return this.influencersService.updatePortalNotes(currentUser.id, body.notes ?? null);
  }

  @Get('dashboard-summary')
  dashboardSummary(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.influencersService.getPortalDashboardSummary(currentUser.id);
  }

  @Get('orders')
  orders(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
  ) {
    return this.influencersService.getPortalOrders(currentUser.id, {
      page: Number(page),
      limit: Number(limit),
      dateFrom,
      dateTo,
      status,
    });
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() body: { currentPassword: string; newPassword: string; confirmPassword: string },
  ) {
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    return this.usersService.changePassword(currentUser.id, {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }

  @Get('payouts')
  payouts(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.influencersService.getPortalPayouts(currentUser.id, {
      page: Number(page),
      limit: Number(limit),
      dateFrom,
      dateTo,
    });
  }
}

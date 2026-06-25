import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { InfluencersService } from './influencers.service';

@Controller('influencer')
@Roles('influencer')
export class InfluencerPortalController {
  constructor(private readonly influencersService: InfluencersService) {}

  @Get('me')
  me(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.influencersService.getPortalMe(currentUser.id);
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

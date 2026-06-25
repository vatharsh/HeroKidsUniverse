import { Body, Controller, Get, Put } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { InfluencersService } from './influencers.service';

@Controller('admin/influencer-settings')
@Roles('admin')
export class AdminInfluencerSettingsController {
  constructor(private readonly influencersService: InfluencersService) {}

  @Get('commission-rules')
  listGlobalRules() {
    return this.influencersService.listCommissionRules(null);
  }

  @Put('commission-rules')
  upsertGlobalRules(@Body() rules: Array<{ minSuccessfulOrders: number; commissionRate: number }>) {
    return this.influencersService.upsertCommissionRules(null, rules);
  }
}

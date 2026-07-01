import { Body, Controller, Post } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { InfluencersService } from './influencers.service';

@Controller('influencers')
export class InfluencerPublicController {
  constructor(private readonly influencersService: InfluencersService) {}

  @Public()
  @Post('coupon/validate')
  validateCoupon(
    @Body() body: { code: string; subtotalAmount?: number; productIds?: string[]; categoryIds?: string[]; userId?: string },
  ) {
    return this.influencersService.validateCoupon(body.code, {
      subtotalAmount: body.subtotalAmount,
      productIds: body.productIds,
      categoryIds: body.categoryIds,
      userId: body.userId,
    });
  }
}

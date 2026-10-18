import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminInfluencerSettingsController } from './admin-influencer-settings.controller';
import { UploadModule } from '../upload/upload.module';
import { AdminInfluencersController } from './admin-influencers.controller';
import { CouponUsageRecord } from './coupon-usage-record.entity';
import { InfluencerPortalController } from './influencer-portal.controller';
import { InfluencerProgramGuard } from './influencer-program';
import { InfluencerCommission } from './influencer-commission.entity';
import { InfluencerCommissionRule } from './influencer-commission-rule.entity';
import { InfluencerCouponCode } from './influencer-coupon-code.entity';
import { InfluencerPayoutCommission } from './influencer-payout-commission.entity';
import { InfluencerPayout } from './influencer-payout.entity';
import { InfluencerPublicController } from './influencer-public.controller';
import { InfluencerReferral } from './influencer-referral.entity';
import { InfluencerWallet } from './influencer-wallet.entity';
import { Influencer } from './influencer.entity';
import { InfluencersService } from './influencers.service';
import { PlatformSetting } from '../admin/platform-setting.entity';
import { Order } from '../merchandise/orders/order.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Influencer,
      InfluencerReferral,
      InfluencerCouponCode,
      CouponUsageRecord,
      InfluencerCommissionRule,
      InfluencerCommission,
      InfluencerWallet,
      InfluencerPayout,
      InfluencerPayoutCommission,
      User,
      Order,
      PlatformSetting,
    ]),
    UploadModule,
    UsersModule,
  ],
  controllers: [AdminInfluencersController, AdminInfluencerSettingsController, InfluencerPublicController, InfluencerPortalController],
  providers: [InfluencersService, InfluencerProgramGuard],
  exports: [InfluencersService, TypeOrmModule],
})
export class InfluencersModule {}

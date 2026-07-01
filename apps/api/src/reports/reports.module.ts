import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { AiUsageLog } from '../ai/entities/ai-usage-log.entity';
import { StoryGenerationCost } from '../ai/entities/story-generation-cost.entity';
import { GenerationJob } from '../generation/generation-job.entity';
import { InfluencerCommission } from '../influencers/influencer-commission.entity';
import { InfluencerCouponCode } from '../influencers/influencer-coupon-code.entity';
import { Influencer } from '../influencers/influencer.entity';
import { Product } from '../merchandise/catalog/product.entity';
import { ProductCategory } from '../merchandise/catalog/product-category.entity';
import { OrderPaymentDetail } from '../merchandise/payments/order-payment-detail.entity';
import { OrderPaymentSummary } from '../merchandise/payments/order-payment-summary.entity';
import { OrderItem } from '../merchandise/orders/order-item.entity';
import { Order } from '../merchandise/orders/order.entity';
import { Story } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { User } from '../users/user.entity';
import { ReportsController } from './reports.controller';
import { ReportsExportService } from './reports-export.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Story,
      Universe,
      Order,
      OrderItem,
      OrderPaymentSummary,
      OrderPaymentDetail,
      AiUsageLog,
      StoryGenerationCost,
      GenerationJob,
      Influencer,
      InfluencerCommission,
      InfluencerCouponCode,
      Product,
      ProductCategory,
      PlatformSetting,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExportService],
})
export class ReportsModule {}

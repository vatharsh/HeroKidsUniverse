import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiUsageLog } from '../ai/entities/ai-usage-log.entity';
import { StoryGenerationCost } from '../ai/entities/story-generation-cost.entity';
import { CreditsModule } from '../credits/credits.module';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { GenerationJob } from '../generation/generation-job.entity';
import { InfluencersModule } from '../influencers/influencers.module';
import { InfluencerReferral } from '../influencers/influencer-referral.entity';
import { Influencer } from '../influencers/influencer.entity';
import { MerchandiseModule } from '../merchandise/merchandise.module';
import { MerchandiseOrder } from '../merchandise/order.entity';
import { OrderStatusHistory } from '../merchandise/order-status-history.entity';
import { PaymentsModule } from '../payments/payments.module';
import { Payment } from '../payments/payment.entity';
import { StoryArc } from '../story-arcs/story-arc.entity';
import { Story } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { User } from '../users/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformSetting } from './platform-setting.entity';
import { PlatformSettingsController } from './platform-settings.controller';

@Module({
  imports: [
    MerchandiseModule,
    PaymentsModule,
    CreditsModule,
    InfluencersModule,
    TypeOrmModule.forFeature([
      User,
      Story,
      Universe,
      GenerationJob,
      AiUsageLog,
      StoryGenerationCost,
      CreditTransaction,
      MerchandiseOrder,
      OrderStatusHistory,
      Payment,
      Influencer,
      InfluencerReferral,
      StoryArc,
      PlatformSetting,
    ]),
  ],
  controllers: [AdminController, PlatformSettingsController],
  providers: [AdminService],
})
export class AdminModule {}

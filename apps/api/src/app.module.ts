import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { AiUsageLog } from './ai/entities/ai-usage-log.entity';
import { AdminModule } from './admin/admin.module';
import { StoryGenerationCost } from './ai/entities/story-generation-cost.entity';
import { StoryGenerationLog } from './ai/entities/story-generation-log.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AvatarsModule } from './avatars/avatars.module';
import { PlatformSetting } from './admin/platform-setting.entity';
import { UserAvatar } from './avatars/entities/user-avatar.entity';
import { CharactersModule } from './characters/characters.module';
import { CharacterVisualProfile } from './characters/entities/character-visual-profile.entity';
import { Character } from './characters/entities/character.entity';
import { CompanionsModule } from './companions/companions.module';
import { UniverseCompanion } from './companions/entities/universe-companion.entity';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CreditPack } from './credits/credit-pack.entity';
import { CreditTransaction } from './credits/credit-transaction.entity';
import { CreditsModule } from './credits/credits.module';
import { GenerationJob } from './generation/generation-job.entity';
import { InfluencersModule } from './influencers/influencers.module';
import { InfluencerCommission } from './influencers/influencer-commission.entity';
import { InfluencerCommissionRule } from './influencers/influencer-commission-rule.entity';
import { InfluencerCouponCode } from './influencers/influencer-coupon-code.entity';
import { InfluencerPayoutCommission } from './influencers/influencer-payout-commission.entity';
import { InfluencerPayout } from './influencers/influencer-payout.entity';
import { InfluencerReferral } from './influencers/influencer-referral.entity';
import { InfluencerWallet } from './influencers/influencer-wallet.entity';
import { Influencer } from './influencers/influencer.entity';
import { MerchandiseModule } from './merchandise/merchandise.module';
import { MerchandiseSizeChart } from './merchandise/catalog/merchandise-size-chart.entity';
import { ProductAttributeValue } from './merchandise/catalog/product-attribute-value.entity';
import { ProductAttribute } from './merchandise/catalog/product-attribute.entity';
import { ProductCategory } from './merchandise/catalog/product-category.entity';
import { ProductVariantAttributeValue } from './merchandise/catalog/product-variant-attribute-value.entity';
import { ProductVariant } from './merchandise/catalog/product-variant.entity';
import { Product } from './merchandise/catalog/product.entity';
import { MerchandiseDesign } from './merchandise/merchandise-design.entity';
import { MerchandiseOrder } from './merchandise/order.entity';
import { OrderPaymentDetail } from './merchandise/payments/order-payment-detail.entity';
import { OrderPaymentSummary } from './merchandise/payments/order-payment-summary.entity';
import { OrderStatusHistory } from './merchandise/order-status-history.entity';
import { OrderItemAttributeValue } from './merchandise/orders/order-item-attribute-value.entity';
import { OrderItemAttribute } from './merchandise/orders/order-item-attribute.entity';
import { OrderItem } from './merchandise/orders/order-item.entity';
import { Order } from './merchandise/orders/order.entity';
import { Hero } from './heroes/hero.entity';
import { HeroesModule } from './heroes/heroes.module';
import { HeroPower } from './powers/hero-power.entity';
import { PaymentsModule } from './payments/payments.module';
import { Payment } from './payments/payment.entity';
import { PowersModule } from './powers/powers.module';
import { Quest } from './quests/quest.entity';
import { QuestsModule } from './quests/quests.module';
import { StoryArc } from './story-arcs/story-arc.entity';
import { StoryArcsModule } from './story-arcs/story-arcs.module';
import { Story } from './stories/story.entity';
import { StoriesModule } from './stories/stories.module';
import { UniverseMemory } from './universes/universe-memory.entity';
import { Universe } from './universes/universe.entity';
import { UniversesModule } from './universes/universes.module';
import { UploadModule } from './upload/upload.module';
import { User } from './users/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          User,
          Hero,
          Character,
          UniverseCompanion,
          Story,
          CreditPack,
          CreditTransaction,
          Universe,
          UniverseMemory,
          Quest,
          HeroPower,
          StoryArc,
          AiUsageLog,
          StoryGenerationLog,
          StoryGenerationCost,
          PlatformSetting,
          UserAvatar,
          GenerationJob,
          CharacterVisualProfile,
          MerchandiseOrder,
          MerchandiseDesign,
          OrderStatusHistory,
          ProductCategory,
          Product,
          ProductAttribute,
          ProductAttributeValue,
          ProductVariant,
          ProductVariantAttributeValue,
          MerchandiseSizeChart,
          Order,
          OrderItem,
          OrderItemAttribute,
          OrderItemAttributeValue,
          OrderPaymentSummary,
          OrderPaymentDetail,
          Payment,
          Influencer,
          InfluencerReferral,
          InfluencerCouponCode,
          InfluencerCommissionRule,
          InfluencerCommission,
          InfluencerWallet,
          InfluencerPayout,
          InfluencerPayoutCommission,
        ],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    AiModule,
    AdminModule,
    AuthModule,
    AvatarsModule,
    HeroesModule,
    CharactersModule,
    CompanionsModule,
    StoriesModule,
    CreditsModule,
    MerchandiseModule,
    PaymentsModule,
    InfluencersModule,
    UploadModule,
    UniversesModule,
    QuestsModule,
    PowersModule,
    StoryArcsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}

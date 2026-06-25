import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { Character } from '../characters/entities/character.entity';
import { Hero } from '../heroes/hero.entity';
import { InfluencersModule } from '../influencers/influencers.module';
import { Story } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { User } from '../users/user.entity';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminOrderV2Controller } from './admin-order-v2.controller';
import { CatalogService } from './catalog/catalog.service';
import { MerchandiseSizeChart } from './catalog/merchandise-size-chart.entity';
import { ProductAttributeValue } from './catalog/product-attribute-value.entity';
import { ProductAttribute } from './catalog/product-attribute.entity';
import { ProductCategory } from './catalog/product-category.entity';
import { ProductVariantAttributeValue } from './catalog/product-variant-attribute-value.entity';
import { ProductVariant } from './catalog/product-variant.entity';
import { Product } from './catalog/product.entity';
import { MerchandiseDesign } from './merchandise-design.entity';
import { MerchandiseCatalogController } from './merchandise-catalog.controller';
import { MerchandiseController } from './merchandise.controller';
import { MerchandiseSeedService } from './merchandise-seed.service';
import { OrderV2Controller } from './order-v2.controller';
import { MerchandiseOrder } from './order.entity';
import { OrderStatusHistory } from './order-status-history.entity';
import { OrderV2Service } from './orders/order-v2.service';
import { OrderPaymentDetail } from './payments/order-payment-detail.entity';
import { OrderPaymentSummary } from './payments/order-payment-summary.entity';
import { MerchandiseService } from './merchandise.service';
import { OrderItemAttributeValue } from './orders/order-item-attribute-value.entity';
import { OrderItemAttribute } from './orders/order-item-attribute.entity';
import { OrderItem } from './orders/order-item.entity';
import { Order } from './orders/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    MerchandiseDesign,
    MerchandiseOrder,
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
    PlatformSetting,
    Hero,
    Character,
    Story,
    Universe,
    User,
  ]), InfluencersModule],
  controllers: [MerchandiseController, MerchandiseCatalogController, OrderV2Controller, AdminCatalogController, AdminOrderV2Controller],
  providers: [MerchandiseService, CatalogService, OrderV2Service, MerchandiseSeedService],
  exports: [MerchandiseService, CatalogService, OrderV2Service],
})
export class MerchandiseModule {}

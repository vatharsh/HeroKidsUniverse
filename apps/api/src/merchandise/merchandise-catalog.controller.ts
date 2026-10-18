import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { CatalogService } from './catalog/catalog.service';
import { StoreAvailabilityService } from './store-availability.service';

@Controller('merchandise/catalog')
export class MerchandiseCatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly store: StoreAvailabilityService,
  ) {}

  @Public()
  @Get('categories')
  async categories() {
    await this.store.assertEnabled();
    return this.catalogService.listCategories();
  }

  @Public()
  @Get('products')
  async products(@Query('categorySlug') categorySlug?: string) {
    await this.store.assertEnabled();
    return this.catalogService.listProducts(categorySlug);
  }

  @Public()
  @Get('products/:slug')
  async product(@Param('slug') slug: string) {
    await this.store.assertEnabled();
    return this.catalogService.getProductBySlug(slug);
  }

  @Public()
  @Get('size-chart/:productId')
  async sizeChart(@Param('productId') productId: string) {
    await this.store.assertEnabled();
    return this.catalogService.getSizeChart(productId);
  }
}

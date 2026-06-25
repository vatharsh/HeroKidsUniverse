import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { CatalogService } from './catalog/catalog.service';

@Controller('merchandise/catalog')
export class MerchandiseCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('categories')
  categories() {
    return this.catalogService.listCategories();
  }

  @Public()
  @Get('products')
  products(@Query('categorySlug') categorySlug?: string) {
    return this.catalogService.listProducts(categorySlug);
  }

  @Public()
  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalogService.getProductBySlug(slug);
  }

  @Public()
  @Get('size-chart/:productId')
  sizeChart(@Param('productId') productId: string) {
    return this.catalogService.getSizeChart(productId);
  }
}

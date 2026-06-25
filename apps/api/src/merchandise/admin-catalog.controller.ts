import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CatalogService } from './catalog/catalog.service';

@Controller('admin/catalog')
@Roles('admin')
export class AdminCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  categories(@Query('includeDeleted') includeDeleted?: string) {
    return this.catalogService.adminListCategories({ includeDeleted: includeDeleted === 'true' });
  }

  @Post('categories')
  createCategory(@Body() body: any) {
    return this.catalogService.createCategory(body);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.catalogService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.catalogService.softDeleteCategory(id, currentUser.id);
  }

  @Get('products')
  products(@Query('categoryId') categoryId?: string, @Query('includeDeleted') includeDeleted?: string) {
    return this.catalogService.adminListProducts(categoryId, { includeDeleted: includeDeleted === 'true' });
  }

  @Post('products')
  createProduct(@Body() body: any) {
    return this.catalogService.createProduct(body);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.catalogService.updateProduct(id, body);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.catalogService.softDeleteProduct(id, currentUser.id);
  }

  @Get('products/:productId/attributes')
  attributes(@Param('productId') productId: string, @Query('includeDeleted') includeDeleted?: string) {
    return this.catalogService.listAttributes(productId, { includeDeleted: includeDeleted === 'true' });
  }

  @Post('products/:productId/attributes')
  createAttribute(@Param('productId') productId: string, @Body() body: any) {
    return this.catalogService.createAttribute({ ...body, productId });
  }

  @Patch('attributes/:id')
  updateAttribute(@Param('id') id: string, @Body() body: any) {
    return this.catalogService.updateAttribute(id, body);
  }

  @Delete('attributes/:id')
  deleteAttribute(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.catalogService.softDeleteAttribute(id, currentUser.id);
  }

  @Get('attributes/:attributeId/values')
  values(@Param('attributeId') attributeId: string, @Query('includeDeleted') includeDeleted?: string) {
    return this.catalogService.listAttributeValues(attributeId, { includeDeleted: includeDeleted === 'true' });
  }

  @Post('attributes/:attributeId/values')
  createValue(@Param('attributeId') attributeId: string, @Body() body: any) {
    return this.catalogService.createAttributeValue({ ...body, attributeId });
  }

  @Patch('attribute-values/:id')
  updateValue(@Param('id') id: string, @Body() body: any) {
    return this.catalogService.updateAttributeValue(id, body);
  }

  @Delete('attribute-values/:id')
  deleteValue(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.catalogService.softDeleteAttributeValue(id, currentUser.id);
  }

  @Get('products/:productId/size-chart')
  sizeChart(@Param('productId') productId: string) {
    return this.catalogService.getSizeChart(productId);
  }

  @Post('products/:productId/size-chart')
  upsertSizeChart(@Param('productId') productId: string, @Body() body: any[]) {
    return this.catalogService.upsertSizeChart(productId, body);
  }
}

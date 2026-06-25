import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateCartOrderDto } from './dto/create-cart-order.dto';
import { CreateDesignDto } from './dto/create-design.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { MerchandiseService } from './merchandise.service';

@Controller('merchandise')
export class MerchandiseController {
  constructor(private readonly merchandiseService: MerchandiseService) {}

  @Public()
  @Get('products')
  findProducts() {
    return this.merchandiseService.findProducts();
  }

  @Public()
  @Get('templates')
  findTemplates(@Query('productId') productId?: string) {
    return this.merchandiseService.findTemplates(productId);
  }

  @Post('designs')
  createDesign(@CurrentUser() currentUser: CurrentUserPayload, @Body() body: CreateDesignDto) {
    return this.merchandiseService.createDesign(currentUser.id, body);
  }

  @Post('designs/:id/preview')
  generatePreview(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.merchandiseService.generatePreview(currentUser.id, id);
  }

  @Get('orders/my')
  findMine(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.merchandiseService.findMine(currentUser.id);
  }

  @Get('my-orders')
  findMineLegacy(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.merchandiseService.findMine(currentUser.id);
  }

  @Get('orders/:id')
  findOne(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.merchandiseService.findOne(currentUser.id, id);
  }

  @Post('orders')
  create(@CurrentUser() currentUser: CurrentUserPayload, @Body() body: CreateOrderDto) {
    return this.merchandiseService.createOrder(currentUser.id, body);
  }

  @Post('orders/cart')
  createCart(@CurrentUser() currentUser: CurrentUserPayload, @Body() body: CreateCartOrderDto) {
    return this.merchandiseService.createCartOrder(currentUser.id, body.items);
  }
}

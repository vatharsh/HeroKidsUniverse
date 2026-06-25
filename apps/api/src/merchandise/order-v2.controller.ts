import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CreateOrderV2Dto } from './orders/dto/create-order-v2.dto';
import { OrderV2Service } from './orders/order-v2.service';

@Controller('merchandise/v2/orders')
export class OrderV2Controller {
  constructor(private readonly orderV2Service: OrderV2Service) {}

  @Post()
  create(@CurrentUser() currentUser: CurrentUserPayload, @Body() body: CreateOrderV2Dto) {
    return this.orderV2Service.createOrder(currentUser.id, body);
  }

  @Get()
  list(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.orderV2Service.listMyOrders(currentUser.id);
  }

  @Get(':id')
  get(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.orderV2Service.getMyOrder(currentUser.id, id);
  }
}

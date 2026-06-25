import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrderV2Service } from './orders/order-v2.service';

@Controller('admin/v2/orders')
@Roles('admin')
export class AdminOrderV2Controller {
  constructor(private readonly orderV2Service: OrderV2Service) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderV2Service.adminListOrders({
      status,
      userId,
      includeDeleted: includeDeleted === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string, @Query('includeDeleted') includeDeleted?: string) {
    return this.orderV2Service.adminGetOrder(id, includeDeleted === 'true');
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.orderV2Service.adminUpdateStatus(id, body.status, body.note, currentUser.id);
  }

  @Patch(':id/notes')
  saveNotes(@Param('id') id: string, @Body('adminNotes') adminNotes: string) {
    return this.orderV2Service.adminSaveNotes(id, adminNotes);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.orderV2Service.adminSoftDeleteOrder(id, currentUser.id);
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SupportService } from './support.service';

@Controller('support/requests')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() body: { orderId?: string; storyId?: string; reason?: string; message?: string }) {
    return this.support.create(user.id, body);
  }

  @Get('mine')
  mine(@CurrentUser() user: CurrentUserPayload) {
    return this.support.mine(user.id);
  }
}

@Controller('admin/support-requests')
@Roles('admin')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.support.adminList(status);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @CurrentUser() admin: CurrentUserPayload, @Body() body: { action?: string; reply?: string }) {
    return this.support.resolve(id, admin.id, body);
  }
}

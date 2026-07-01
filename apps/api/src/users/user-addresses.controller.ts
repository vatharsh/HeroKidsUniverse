import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { UserAddressesService } from './user-addresses.service';
import type { UpsertAddressDto } from './user-addresses.service';

@Controller('users/me/addresses')
export class UserAddressesController {
  constructor(private readonly service: UserAddressesService) {}

  @Get()
  list(@CurrentUser() cu: CurrentUserPayload) {
    return this.service.list(cu.id);
  }

  @Post()
  create(@CurrentUser() cu: CurrentUserPayload, @Body() body: UpsertAddressDto) {
    return this.service.create(cu.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() cu: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: Partial<UpsertAddressDto>,
  ) {
    return this.service.update(cu.id, id, body);
  }

  @Patch(':id/set-default')
  setDefault(@CurrentUser() cu: CurrentUserPayload, @Param('id') id: string) {
    return this.service.setDefault(cu.id, id);
  }

  @Delete(':id')
  softDelete(@CurrentUser() cu: CurrentUserPayload, @Param('id') id: string) {
    return this.service.softDelete(cu.id, id);
  }
}

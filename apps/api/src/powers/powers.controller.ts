import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CreateHeroPowerDto } from './dto/create-hero-power.dto';
import { PowersService } from './powers.service';

@Controller('powers')
export class PowersController {
  constructor(private readonly powersService: PowersService) {}

  @Get()
  list(@CurrentUser() currentUser: CurrentUserPayload, @Query('universeId') universeId: string) {
    return this.powersService.list(currentUser.id, universeId);
  }

  @Post()
  create(@CurrentUser() currentUser: CurrentUserPayload, @Body() dto: CreateHeroPowerDto) {
    return this.powersService.create(currentUser.id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.powersService.remove(currentUser.id, id);
  }
}

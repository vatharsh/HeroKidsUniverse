import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CreateUniverseDto } from './dto/create-universe.dto';
import { UpdateUniverseDto } from './dto/update-universe.dto';
import { UniversesService } from './universes.service';

@Controller('universes')
export class UniversesController {
  constructor(private readonly universesService: UniversesService) {}

  @Post()
  create(@CurrentUser() currentUser: CurrentUserPayload, @Body() dto: CreateUniverseDto) {
    return this.universesService.create(currentUser.id, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.universesService.findMine(currentUser.id);
  }

  @Get('mine/stats')
  getStats(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.universesService.getStats(currentUser.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUniverseDto,
  ) {
    return this.universesService.update(currentUser.id, id, dto);
  }

  @Get(':id/timeline')
  getTimeline(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.universesService.getTimeline(currentUser.id, id);
  }
}

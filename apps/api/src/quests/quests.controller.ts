import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CreateQuestDto } from './dto/create-quest.dto';
import { QuestsService } from './quests.service';

@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get()
  list(@CurrentUser() currentUser: CurrentUserPayload, @Query('universeId') universeId: string) {
    return this.questsService.list(currentUser.id, universeId);
  }

  @Post()
  create(@CurrentUser() currentUser: CurrentUserPayload, @Body() dto: CreateQuestDto) {
    return this.questsService.create(currentUser.id, dto);
  }

  @Patch(':id/complete')
  complete(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.questsService.complete(currentUser.id, id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.questsService.remove(currentUser.id, id);
  }
}

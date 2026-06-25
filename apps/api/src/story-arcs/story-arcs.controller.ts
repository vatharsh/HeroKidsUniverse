import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CreateStoryArcDto } from './dto/create-story-arc.dto';
import { StoryArcsService } from './story-arcs.service';

@Controller('story-arcs')
export class StoryArcsController {
  constructor(private readonly storyArcsService: StoryArcsService) {}

  @Get()
  list(@CurrentUser() currentUser: CurrentUserPayload, @Query('universeId') universeId: string) {
    return this.storyArcsService.list(currentUser.id, universeId);
  }

  @Post()
  create(@CurrentUser() currentUser: CurrentUserPayload, @Body() dto: CreateStoryArcDto) {
    return this.storyArcsService.create(currentUser.id, dto);
  }

  @Patch(':id/complete')
  complete(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.storyArcsService.complete(currentUser.id, id);
  }
}

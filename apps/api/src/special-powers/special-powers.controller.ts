import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SpecialPowersService } from './special-powers.service';

@Controller('special-powers')
export class SpecialPowersController {
  constructor(private readonly powers: SpecialPowersService) {}

  @Get('today')
  today(@CurrentUser() user: CurrentUserPayload) {
    return this.powers.todayForUser(user.id);
  }

  @Get('book/:heroId')
  book(@CurrentUser() user: CurrentUserPayload, @Param('heroId') heroId: string) {
    return this.powers.book(user.id, heroId);
  }

  @Get('story/:storyId')
  forStory(@CurrentUser() user: CurrentUserPayload, @Param('storyId') storyId: string) {
    return this.powers.forStory(user.id, storyId);
  }

  @Post('story/:storyId/claim')
  claim(@CurrentUser() user: CurrentUserPayload, @Param('storyId') storyId: string, @Body('dropId') dropId: string) {
    return this.powers.claim(user.id, storyId, dropId);
  }
}

@Controller('admin/special-powers')
@Roles('admin')
export class AdminSpecialPowersController {
  constructor(private readonly powers: SpecialPowersService) {}

  @Get()
  list() {
    return this.powers.adminList();
  }

  @Get('library')
  library() {
    return this.powers.library();
  }

  @Post()
  create(@Body() body: { day?: string; powerKey?: string | null; name?: string; emoji?: string; description?: string }) {
    return this.powers.create(body);
  }

  @Post('plan')
  plan(@Body('weeks') weeks?: number) {
    return this.powers.planAhead(Math.min(8, Math.max(1, Number(weeks) || 2)));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.powers.remove(id);
  }
}

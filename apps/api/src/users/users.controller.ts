import { BadRequestException, Body, Controller, Get, Patch } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { UserNotificationPreferencesService } from './user-notification-preferences.service';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notifService: UserNotificationPreferencesService,
  ) {}

  @Get('me')
  getProfile(@CurrentUser() cu: CurrentUserPayload) {
    return this.usersService.getProfile(cu.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() cu: CurrentUserPayload,
    @Body() body: { name?: string; phone?: string },
  ) {
    return this.usersService.updateProfile(cu.id, body);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser() cu: CurrentUserPayload,
    @Body() body: { currentPassword: string; newPassword: string; confirmPassword: string },
  ) {
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    return this.usersService.changePassword(cu.id, {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }

  @Get('me/notification-preferences')
  getNotifPrefs(@CurrentUser() cu: CurrentUserPayload) {
    return this.notifService.get(cu.id);
  }

  @Patch('me/notification-preferences')
  updateNotifPrefs(
    @CurrentUser() cu: CurrentUserPayload,
    @Body() body: { orderUpdates?: boolean; storyUpdates?: boolean; promotionalEmails?: boolean; specialOffers?: boolean },
  ) {
    return this.notifService.update(cu.id, body);
  }
}

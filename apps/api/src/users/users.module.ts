import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserAddress } from './user-address.entity';
import { UserAddressesController } from './user-addresses.controller';
import { UserAddressesService } from './user-addresses.service';
import { UserNotificationPreferences } from './user-notification-preferences.entity';
import { UserNotificationPreferencesService } from './user-notification-preferences.service';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserAddress, UserNotificationPreferences])],
  controllers: [UsersController, UserAddressesController],
  providers: [UsersService, UserAddressesService, UserNotificationPreferencesService],
  exports: [UsersService, UserAddressesService],
})
export class UsersModule {}

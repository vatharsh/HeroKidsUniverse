import { Module } from '@nestjs/common';

import { AdminSpecialPowersController, SpecialPowersController } from './special-powers.controller';
import { SpecialPowersService } from './special-powers.service';

@Module({
  controllers: [SpecialPowersController, AdminSpecialPowersController],
  providers: [SpecialPowersService],
})
export class SpecialPowersModule {}

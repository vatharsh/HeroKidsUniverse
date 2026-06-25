import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Universe } from '../universes/universe.entity';
import { HeroPower } from './hero-power.entity';
import { PowersController } from './powers.controller';
import { PowersService } from './powers.service';

@Module({
  imports: [TypeOrmModule.forFeature([HeroPower, Universe])],
  controllers: [PowersController],
  providers: [PowersService],
})
export class PowersModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HeroPower } from '../powers/hero-power.entity';
import { Quest } from '../quests/quest.entity';
import { UniverseMemory } from './universe-memory.entity';
import { Universe } from './universe.entity';
import { UniversesController } from './universes.controller';
import { UniversesService } from './universes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Universe, UniverseMemory, HeroPower, Quest])],
  controllers: [UniversesController],
  providers: [UniversesService],
  exports: [UniversesService],
})
export class UniversesModule {}

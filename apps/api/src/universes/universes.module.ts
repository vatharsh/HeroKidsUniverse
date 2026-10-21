import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Quest } from '../quests/quest.entity';
import { UniverseMemory } from './universe-memory.entity';
import { UniverseVillain } from './universe-villain.entity';
import { Universe } from './universe.entity';
import { UniversesController } from './universes.controller';
import { UniversesService } from './universes.service';
import { Story } from '../stories/story.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Universe, UniverseMemory, UniverseVillain, HeroPower, Quest, PlatformSetting, Story])],
  controllers: [UniversesController],
  providers: [UniversesService],
  exports: [UniversesService],
})
export class UniversesModule {}

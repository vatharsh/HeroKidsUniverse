import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModule } from '../ai/ai.module';
import { AiUsageLog } from '../ai/entities/ai-usage-log.entity';
import { StoryGenerationCost } from '../ai/entities/story-generation-cost.entity';
import { StoryGenerationLog } from '../ai/entities/story-generation-log.entity';
import { Character } from '../characters/entities/character.entity';
import { UniverseCompanion } from '../companions/entities/universe-companion.entity';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { Hero } from '../heroes/hero.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Quest } from '../quests/quest.entity';
import { Story } from '../stories/story.entity';
import { StoryArc } from '../story-arcs/story-arc.entity';
import { UniverseMemory } from '../universes/universe-memory.entity';
import { Universe } from '../universes/universe.entity';
import { PlatformSetting } from '../admin/platform-setting.entity';
import { User } from '../users/user.entity';
import { UploadModule } from '../upload/upload.module';
import { GenerationJob } from './generation-job.entity';
import { GenerationJobsController } from './generation-jobs.controller';
import { GenerationService } from './generation.service';

@Module({
  imports: [
    AiModule,
    UploadModule,
    TypeOrmModule.forFeature([
      Story,
      Hero,
      Universe,
      UniverseMemory,
      HeroPower,
      Quest,
      AiUsageLog,
      StoryGenerationLog,
      StoryGenerationCost,
      Character,
      UniverseCompanion,
      User,
      StoryArc,
      CreditTransaction,
      GenerationJob,
      PlatformSetting,
    ]),
  ],
  controllers: [GenerationJobsController],
  providers: [GenerationService],
  exports: [GenerationService],
})
export class GenerationModule {}

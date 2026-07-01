import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { CharactersModule } from '../characters/characters.module';
import { Character } from '../characters/entities/character.entity';
import { CompanionsModule } from '../companions/companions.module';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { GenerationModule } from '../generation/generation.module';
import { VideoGenerationService } from '../generation/video-generation.service';
import { Hero } from '../heroes/hero.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { Quest } from '../quests/quest.entity';
import { UniverseMemory } from '../universes/universe-memory.entity';
import { Universe } from '../universes/universe.entity';
import { UploadModule } from '../upload/upload.module';
import { User } from '../users/user.entity';
import { Story } from './story.entity';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Story,
      Hero,
      Character,
      User,
      CreditTransaction,
      Universe,
      UniverseMemory,
      HeroPower,
      Quest,
      PlatformSetting,
    ]),
    CharactersModule,
    CompanionsModule,
    GenerationModule,
    UploadModule,
  ],
  controllers: [StoriesController],
  providers: [StoriesService, VideoGenerationService],
})
export class StoriesModule {}

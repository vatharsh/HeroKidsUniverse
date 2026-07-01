import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { CharacterCanon } from '../characters/entities/character-canon.entity';
import { Story } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { UploadModule } from '../upload/upload.module';
import { AIQualityAssuranceService } from './ai-quality-assurance.service';
import { AiModule } from './ai.module';
import { StoryQaPage } from './entities/story-qa-page.entity';
import { StoryQaRun } from './entities/story-qa-run.entity';

@Module({
  imports: [
    AiModule,
    UploadModule,
    TypeOrmModule.forFeature([
      StoryQaRun,
      StoryQaPage,
      Story,
      CharacterCanon,
      Universe,
      PlatformSetting,
    ]),
  ],
  providers: [AIQualityAssuranceService],
  exports: [AIQualityAssuranceService],
})
export class AIQualityAssuranceModule {}

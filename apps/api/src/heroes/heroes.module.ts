import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModule } from '../ai/ai.module';
import { Story } from '../stories/story.entity';
import { UploadModule } from '../upload/upload.module';
import { Hero } from './hero.entity';
import { HeroesController } from './heroes.controller';
import { HeroesService } from './heroes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Hero, Story]), UploadModule, AiModule],
  controllers: [HeroesController],
  providers: [HeroesService],
  exports: [HeroesService],
})
export class HeroesModule {}

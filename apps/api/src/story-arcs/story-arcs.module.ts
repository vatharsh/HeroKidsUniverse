import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Universe } from '../universes/universe.entity';
import { StoryArc } from './story-arc.entity';
import { StoryArcsController } from './story-arcs.controller';
import { StoryArcsService } from './story-arcs.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoryArc, Universe])],
  controllers: [StoryArcsController],
  providers: [StoryArcsService],
})
export class StoryArcsModule {}

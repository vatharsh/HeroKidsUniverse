import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Universe } from '../universes/universe.entity';
import { Quest } from './quest.entity';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';

@Module({
  imports: [TypeOrmModule.forFeature([Quest, Universe])],
  controllers: [QuestsController],
  providers: [QuestsService],
})
export class QuestsModule {}

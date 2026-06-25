import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Universe } from '../universes/universe.entity';
import { CompanionsController } from './companions.controller';
import { CompanionsService } from './companions.service';
import { UniverseCompanion } from './entities/universe-companion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UniverseCompanion, Universe])],
  controllers: [CompanionsController],
  providers: [CompanionsService],
  exports: [CompanionsService],
})
export class CompanionsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModule } from '../ai/ai.module';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { UploadModule } from '../upload/upload.module';
import { User } from '../users/user.entity';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';
import { Character } from './entities/character.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Character, User, CreditTransaction]), UploadModule, AiModule],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}

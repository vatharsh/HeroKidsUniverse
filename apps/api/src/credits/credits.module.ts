import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/user.entity';
import { CreditPack } from './credit-pack.entity';
import { CreditPacksService } from './credit-packs.service';
import { CreditTransaction } from './credit-transaction.entity';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';

@Module({
  imports: [TypeOrmModule.forFeature([CreditPack, CreditTransaction, User])],
  controllers: [CreditsController],
  providers: [CreditsService, CreditPacksService],
  exports: [CreditPacksService],
})
export class CreditsModule {}

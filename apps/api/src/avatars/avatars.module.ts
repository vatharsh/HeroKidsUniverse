import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModule } from '../ai/ai.module';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { UploadModule } from '../upload/upload.module';
import { User } from '../users/user.entity';
import { AvatarsController } from './avatars.controller';
import { AvatarsService } from './avatars.service';
import { UserAvatar } from './entities/user-avatar.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAvatar, User, CreditTransaction]),
    AiModule,
    UploadModule,
  ],
  controllers: [AvatarsController],
  providers:   [AvatarsService],
})
export class AvatarsModule {}

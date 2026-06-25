import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { CreditTransaction, CreditTransactionReason } from './credit-transaction.entity';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(CreditTransaction)
    private readonly transactionsRepository: Repository<CreditTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async getCredits(userId: string) {
    const [user, transactions] = await Promise.all([
      this.usersRepository.findOneOrFail({ where: { id: userId } }),
      this.transactionsRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
    ]);

    return {
      balance: user.credits,
      characterSlotsTotal: user.characterSlotsTotal,
      characterSlotsUsed: user.characterSlotsUsed,
      characterSlotsRemaining: user.characterSlotsTotal < 0
        ? null
        : Math.max(0, user.characterSlotsTotal - user.characterSlotsUsed),
      avatarRefreshTokens: user.avatarRefreshTokens,
      transactions,
    };
  }

  async claimDemoCredit(userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const existingDemo = await manager.findOne(CreditTransaction, {
        where: { userId, reason: CreditTransactionReason.Demo },
      });

      if (existingDemo) {
        throw new ConflictException('Demo credit already claimed');
      }

      const user = await manager.findOneOrFail(User, { where: { id: userId } });
      user.credits += 1;
      await manager.save(user);

      await manager.save(
        manager.create(CreditTransaction, {
          userId,
          delta: 1,
          reason: CreditTransactionReason.Demo,
          referenceId: null,
        }),
      );

      return { balance: user.credits };
    });
  }
}

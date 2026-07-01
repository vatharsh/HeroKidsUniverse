import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserNotificationPreferences } from './user-notification-preferences.entity';

@Injectable()
export class UserNotificationPreferencesService {
  constructor(
    @InjectRepository(UserNotificationPreferences)
    private readonly repo: Repository<UserNotificationPreferences>,
  ) {}

  async get(userId: string): Promise<UserNotificationPreferences> {
    let prefs = await this.repo.findOne({ where: { userId } });
    if (!prefs) {
      prefs = await this.repo.save(this.repo.create({ userId }));
    }
    return prefs;
  }

  async update(
    userId: string,
    dto: Partial<Pick<UserNotificationPreferences, 'orderUpdates' | 'storyUpdates' | 'promotionalEmails' | 'specialOffers'>>,
  ): Promise<UserNotificationPreferences> {
    let prefs = await this.repo.findOne({ where: { userId } });
    if (!prefs) prefs = this.repo.create({ userId });
    Object.assign(prefs, dto);
    return this.repo.save(prefs);
  }
}

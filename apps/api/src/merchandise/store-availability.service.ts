import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';

const STORE_SETTING_KEY = 'ENABLE_MERCHANDISE';

/**
 * Master switch for the online store (merchandise catalog, designs, cart and checkout).
 * Credit-pack and avatar purchases are deliberately NOT covered — they stay available when the store is off.
 */
@Injectable()
export class StoreAvailabilityService {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
  ) {}

  async isEnabled(): Promise<boolean> {
    const row = await this.settingsRepo.findOne({ where: { key: STORE_SETTING_KEY } });
    const value = row?.value ?? SETTING_DEFAULTS[STORE_SETTING_KEY].value;
    return value === 'true' || value === '1';
  }

  async assertEnabled(): Promise<void> {
    if (!(await this.isEnabled())) {
      throw new ForbiddenException('The online store is currently unavailable');
    }
  }
}

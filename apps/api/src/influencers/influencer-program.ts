import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';

const PROGRAM_SETTING_KEY = 'ENABLE_INFLUENCER_PROGRAM';

export const INFLUENCER_PROGRAM_PAUSED_MESSAGE = 'The influencer programme is currently paused';

/**
 * Master switch for the influencer programme: influencer login, the influencer portal, and influencer coupons.
 * Platform (non-influencer) coupons and the admin influencer tools are deliberately NOT covered.
 */
export async function isInfluencerProgramEnabled(settingsRepo: Repository<PlatformSetting>): Promise<boolean> {
  const row = await settingsRepo.findOne({ where: { key: PROGRAM_SETTING_KEY } });
  const value = row?.value ?? SETTING_DEFAULTS[PROGRAM_SETTING_KEY].value;
  return value === 'true' || value === '1';
}

/** Blocks the influencer portal API while the programme is off (covers influencers who are already logged in). */
@Injectable()
export class InfluencerProgramGuard implements CanActivate {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
  ) {}

  async canActivate(): Promise<boolean> {
    if (!(await isInfluencerProgramEnabled(this.settingsRepo))) {
      throw new ForbiddenException(INFLUENCER_PROGRAM_PAUSED_MESSAGE);
    }
    return true;
  }
}

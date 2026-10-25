import { DataSource } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';

export interface MaintenanceState {
  on: boolean;
  message: string;
  backBy: string;
}

const CACHE_MS = 10_000;
let cached: { at: number; state: MaintenanceState } | null = null;

/** Maintenance switch (MAINTENANCE_MODE), read at most every 10s — it's checked on every write request. */
export async function maintenanceState(dataSource: DataSource): Promise<MaintenanceState> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.state;
  const rows = await dataSource.getRepository(PlatformSetting).find({
    where: [{ key: 'MAINTENANCE_MODE' }, { key: 'MAINTENANCE_MESSAGE' }, { key: 'MAINTENANCE_BACK_BY' }],
  });
  const get = (key: keyof typeof SETTING_DEFAULTS) => rows.find((r) => r.key === key)?.value ?? SETTING_DEFAULTS[key].value;
  const state = {
    on: get('MAINTENANCE_MODE') === 'true',
    message: get('MAINTENANCE_MESSAGE').trim() || SETTING_DEFAULTS.MAINTENANCE_MESSAGE.value,
    backBy: get('MAINTENANCE_BACK_BY').trim(),
  };
  cached = { at: Date.now(), state };
  return state;
}

/** Called when an admin saves a maintenance setting, so the switch takes effect immediately. */
export function clearMaintenanceCache(): void {
  cached = null;
}

/** What parents are told when something they tried is paused. */
export function maintenanceMessage(state: MaintenanceState): string {
  return state.backBy ? `${state.message} We'll be back by ${state.backBy}.` : state.message;
}

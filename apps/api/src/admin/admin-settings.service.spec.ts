import { BadRequestException } from '@nestjs/common';

import { AdminService } from './admin.service';
import { PUBLIC_SETTING_KEYS } from './platform-setting.entity';

function makeService(settingsRepo: Record<string, jest.Mock>) {
  const service = Object.create(AdminService.prototype) as AdminService;
  (service as any).settingsRepo = settingsRepo;
  return service;
}

describe('AdminService — public settings allowlist', () => {
  it('getPublicSettings returns only keys in PUBLIC_SETTING_KEYS', async () => {
    const storedRows = [
      { key: 'ENABLE_MERCHANDISE', value: 'false' },
      { key: 'AI_DAILY_COST_HARD_LIMIT_USD', value: '25' },
      { key: 'QA_ENABLED', value: 'true' },
      { key: 'GEMINI_INPUT_COST_PER_1M_TOKENS', value: '0.10' },
    ];
    const settingsRepo = {
      find: jest.fn().mockResolvedValue(storedRows),
    };
    const service = makeService(settingsRepo);

    const result = await service.getPublicSettings();
    const returnedKeys = result.map((s: { key: string }) => s.key);

    expect(returnedKeys).toEqual(expect.arrayContaining([...PUBLIC_SETTING_KEYS]));
    // Must not expose private keys
    expect(returnedKeys).not.toContain('AI_DAILY_COST_HARD_LIMIT_USD');
    expect(returnedKeys).not.toContain('QA_ENABLED');
    expect(returnedKeys).not.toContain('GEMINI_INPUT_COST_PER_1M_TOKENS');
    expect(returnedKeys).not.toContain('OPENAI_IMAGE_COST_PER_IMAGE');
    expect(returnedKeys).not.toContain('TTS_VOICE');
    expect(returnedKeys).not.toContain('SANDBOX_MODE');
  });

  it('getPublicSettings returns stored DB value when key is present', async () => {
    const settingsRepo = {
      find: jest.fn().mockResolvedValue([{ key: 'ENABLE_MERCHANDISE', value: 'false' }]),
    };
    const service = makeService(settingsRepo);
    const result = await service.getPublicSettings();
    const merch = (result as Array<{ key: string; value: string }>).find((s) => s.key === 'ENABLE_MERCHANDISE');
    expect(merch?.value).toBe('false');
  });

  it('getPublicSettings falls back to SETTING_DEFAULTS when key is not in DB', async () => {
    const settingsRepo = {
      find: jest.fn().mockResolvedValue([]), // empty DB
    };
    const service = makeService(settingsRepo);
    const result = await service.getPublicSettings();
    // All keys should still be present with default values
    expect(result.length).toBe(PUBLIC_SETTING_KEYS.length);
    result.forEach((s: { key: string; value: string }) => {
      expect(typeof s.value).toBe('string');
    });
  });

  it('PUBLIC_SETTING_KEYS does not include any AI pricing or QA settings', () => {
    const forbidden = [
      'GEMINI_INPUT_COST_PER_1M_TOKENS',
      'GEMINI_OUTPUT_COST_PER_1M_TOKENS',
      'OPENAI_IMAGE_COST_PER_IMAGE',
      'OPENAI_TTS_COST_PER_CHAR',
      'AI_DAILY_COST_HARD_LIMIT_USD',
      'AI_MONTHLY_COST_HARD_LIMIT_USD',
      'AI_DAILY_COST_WARNING_USD',
      'AI_MONTHLY_COST_WARNING_USD',
      'QA_ENABLED',
      'QA_MAX_RETRIES',
      'QA_FORCE_REGENERATION',
      'TTS_VOICE',
      'TTS_SPEED_RATIO',
      'TTS_ACCENT_STYLE',
      'TTS_TONE',
      'SANDBOX_MODE',
    ];
    for (const key of forbidden) {
      expect(PUBLIC_SETTING_KEYS).not.toContain(key);
    }
  });
});

describe('AdminService settings validation', () => {
  it('rejects invalid number settings instead of saving zero silently', async () => {
    const settingsRepo = {
      findOne: jest.fn(),
      upsert: jest.fn(),
    };
    const service = makeService(settingsRepo);

    await expect(service.upsertSetting('USD_INR_RATE', 'not-a-number'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(settingsRepo.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid boolean strings', async () => {
    const settingsRepo = {
      findOne: jest.fn(),
      upsert: jest.fn(),
    };
    const service = makeService(settingsRepo);

    await expect(service.upsertSetting('ENABLE_NARRATION', 'maybe'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(settingsRepo.upsert).not.toHaveBeenCalled();
  });

  it('persists valid boolean settings and reloads the saved row', async () => {
    const settingsRepo = {
      findOne: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ key: 'ENABLE_NARRATION', value: 'false', type: 'boolean' }),
      upsert: jest.fn().mockResolvedValue({}),
    };
    const service = makeService(settingsRepo);

    const result = await service.upsertSetting('ENABLE_NARRATION', false);

    expect(settingsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'ENABLE_NARRATION', value: 'false', type: 'boolean' }),
      ['key'],
    );
    expect(result).toEqual(expect.objectContaining({ value: 'false' }));
  });
});

/**
 * CharacterCanonService — CHARACTER_CANON_MIN_QUALITY wiring tests
 *
 * Verifies that the quality threshold is read from platform settings,
 * not hardcoded to 70.
 */

import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';

import { CharacterCanonService } from './character-canon.service';
import { CharacterCanon } from './entities/character-canon.entity';
import { Character } from './entities/character.entity';
import { Hero } from '../heroes/hero.entity';
import { UniverseCompanion } from '../companions/entities/universe-companion.entity';
import { PlatformSetting } from '../admin/platform-setting.entity';
import { IMAGE_GENERATION_PROVIDER } from '../ai/interfaces/image-generation.provider';

function makeRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve({ id: 'saved', ...(e as object) })),
    create: jest.fn().mockImplementation((e: unknown) => e),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeImageProvider(qualityScore = 85) {
  return {
    describeCharacterAppearanceFromUrl: jest.fn().mockResolvedValue('A child with brown hair and bright eyes.'),
    client: {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  identityJson: { approximate_age_range: '7-9 years', skin_tone: 'warm medium' },
                  appearanceSummary: 'A cheerful boy with bright eyes.',
                  neverChangeRules: ['Never change hairstyle.'],
                  distinctiveFeatures: [],
                  faceMetrics: { face_width_category: 'medium' },
                  qualityScore,
                }),
              },
            }],
          }),
        },
      },
    },
  };
}

async function buildModule(options: {
  minQualitySettingValue?: string | null;
  qualityScore?: number;
} = {}) {
  const { minQualitySettingValue, qualityScore = 85 } = options;

  const settingsRepo = makeRepo({
    findOne: jest.fn().mockResolvedValue(
      minQualitySettingValue !== null && minQualitySettingValue !== undefined
        ? { key: 'CHARACTER_CANON_MIN_QUALITY', value: minQualitySettingValue }
        : null,
    ),
  });

  const canonRepo = makeRepo();
  const imageProvider = makeImageProvider(qualityScore);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CharacterCanonService,
      { provide: IMAGE_GENERATION_PROVIDER, useValue: imageProvider },
      { provide: getRepositoryToken(CharacterCanon), useValue: canonRepo },
      { provide: getRepositoryToken(Hero), useValue: makeRepo() },
      { provide: getRepositoryToken(Character), useValue: makeRepo() },
      { provide: getRepositoryToken(UniverseCompanion), useValue: makeRepo() },
      { provide: getRepositoryToken(PlatformSetting), useValue: settingsRepo },
    ],
  }).compile();

  return {
    service: module.get<CharacterCanonService>(CharacterCanonService),
    canonRepo,
    settingsRepo,
  };
}

const BASE_PARAMS = {
  heroId: 'hero-1',
  userId: 'user-1',
  avatarUrl: 'http://example.com/avatar.png',
  canonType: 'hero' as const,
};

describe('CharacterCanonService — CHARACTER_CANON_MIN_QUALITY', () => {
  it('sets status=complete when qualityScore >= CHARACTER_CANON_MIN_QUALITY', async () => {
    const { service, canonRepo } = await buildModule({ minQualitySettingValue: '80', qualityScore: 85 });
    await service.generateCanonFromAvatar(BASE_PARAMS);
    const saved = (canonRepo.save as jest.Mock).mock.calls
      .map((c: unknown[][]) => c[0] as { status?: string })
      .find((e: { status?: string }) => e.status === 'complete' || e.status === 'needs_review');
    expect(saved?.status).toBe('complete');
  });

  it('sets status=needs_review when qualityScore < CHARACTER_CANON_MIN_QUALITY', async () => {
    const { service, canonRepo } = await buildModule({ minQualitySettingValue: '90', qualityScore: 85 });
    await service.generateCanonFromAvatar(BASE_PARAMS);
    const saved = (canonRepo.save as jest.Mock).mock.calls
      .map((c: unknown[][]) => c[0] as { status?: string })
      .find((e: { status?: string }) => e.status === 'complete' || e.status === 'needs_review');
    expect(saved?.status).toBe('needs_review');
  });

  it('falls back to 70 when no setting is stored and qualityScore=75 → complete', async () => {
    const { service, canonRepo } = await buildModule({ minQualitySettingValue: null, qualityScore: 75 });
    await service.generateCanonFromAvatar(BASE_PARAMS);
    const saved = (canonRepo.save as jest.Mock).mock.calls
      .map((c: unknown[][]) => c[0] as { status?: string })
      .find((e: { status?: string }) => e.status === 'complete' || e.status === 'needs_review');
    expect(saved?.status).toBe('complete');
  });

  it('falls back to 70 when no setting is stored and qualityScore=60 → needs_review', async () => {
    const { service, canonRepo } = await buildModule({ minQualitySettingValue: null, qualityScore: 60 });
    await service.generateCanonFromAvatar(BASE_PARAMS);
    const saved = (canonRepo.save as jest.Mock).mock.calls
      .map((c: unknown[][]) => c[0] as { status?: string })
      .find((e: { status?: string }) => e.status === 'complete' || e.status === 'needs_review');
    expect(saved?.status).toBe('needs_review');
  });

  it('reads CHARACTER_CANON_MIN_QUALITY from DB via settingsRepo.findOne', async () => {
    const { service, settingsRepo } = await buildModule({ minQualitySettingValue: '75', qualityScore: 80 });
    await service.generateCanonFromAvatar(BASE_PARAMS);
    expect((settingsRepo.findOne as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'CHARACTER_CANON_MIN_QUALITY' } }),
    );
  });

  it('handles non-numeric setting value gracefully (falls back to 70)', async () => {
    const { service, canonRepo } = await buildModule({ minQualitySettingValue: 'not-a-number', qualityScore: 75 });
    await service.generateCanonFromAvatar(BASE_PARAMS);
    const saved = (canonRepo.save as jest.Mock).mock.calls
      .map((c: unknown[][]) => c[0] as { status?: string })
      .find((e: { status?: string }) => e.status === 'complete' || e.status === 'needs_review');
    // 75 >= 70 (fallback) → complete
    expect(saved?.status).toBe('complete');
  });
});

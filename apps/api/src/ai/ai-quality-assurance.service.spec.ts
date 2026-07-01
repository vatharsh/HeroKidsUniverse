/**
 * AIQualityAssuranceService — automated test suite
 *
 * Tests cover:
 * - QA scoring for all 6 dimensions (identity, story, expression, dialogue, composition, narration)
 * - DB persistence (story_qa_runs, story_qa_pages)
 * - Auto-regeneration trigger, page retry, max-retry limit
 * - Error handling — face comparison errors fall back gracefully
 * - Prompt version stored with QA run
 * - Speech bubble speaker validation (null speaker deducts points)
 * - QA skip mode (QA_ENABLED=false returns perfect score)
 */

import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';

import { AIQualityAssuranceService } from './ai-quality-assurance.service';
import { IMAGE_GENERATION_PROVIDER } from './interfaces/image-generation.provider';
import { Story, StoryStatus } from '../stories/story.entity';
import type { StoryPage } from '../stories/story.entity';
import { Hero } from '../heroes/hero.entity';
import { CharacterCanon } from '../characters/entities/character-canon.entity';
import { StoryQaRun } from './entities/story-qa-run.entity';
import { StoryQaPage } from './entities/story-qa-page.entity';
import { PlatformSetting } from '../admin/platform-setting.entity';
import { Universe } from '../universes/universe.entity';
import { UploadService } from '../upload/upload.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeHero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'hero-1',
    userId: 'user-1',
    name: 'Siddhant',
    age: 8,
    gender: 'boy',
    avatarUrl: 'http://localhost:3000/api/upload/files/avatar.png',
    ...overrides,
  } as Hero;
}

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'story-1',
    userId: 'user-1',
    heroId: 'hero-1',
    status: StoryStatus.Completed,
    isSandbox: true,
    overallConfidence: null,
    universeId: null,
    pages: [],
    ...overrides,
  } as Story;
}

function makePage(pageNumber: number, overrides: Partial<StoryPage> = {}): StoryPage {
  return {
    pageNumber,
    text: `Siddhant found a clue on page ${pageNumber} and kept going bravely through the jungle.`,
    sceneDescription: 'Wide scene with Siddhant in the jungle.',
    imageUrl: `http://localhost:3000/api/upload/files/page-${pageNumber}.png`,
    characterDirections: [
      { name: 'Siddhant', role: 'hero', expression: 'wide excited grin, bright eyes', pose: 'running forward' },
    ],
    speechBubbles: [],
    dialogue: [],
    storyStateSnapshot: {
      costume: 'red jacket',
      companion: null,
      weapon: null,
      location: 'jungle',
      powers: [],
      inventory: [],
    },
    ...overrides,
  } as unknown as StoryPage;
}

function makePages(count = 4): StoryPage[] {
  return Array.from({ length: count }, (_, i) => makePage(i + 1));
}

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeImageProvider(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
      identityScore: 8,
      recommendation: 'accept',
      issues: [],
    }),
    generateImage: jest.fn().mockResolvedValue({
      imageUrl: 'http://localhost:3000/api/upload/files/regen.png',
    }),
    ...overrides,
  };
}

function makeRepository(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: unknown) =>
      Promise.resolve(Array.isArray(e) ? e : { id: 'saved-id', ...(e as object) }),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn().mockImplementation((e: unknown) => e),
    ...overrides,
  };
}

// ─── Module builder ───────────────────────────────────────────────────────────

async function buildModule(options: {
  imageProviderOverrides?: Partial<Record<string, jest.Mock>>;
  settingRows?: Array<{ key: string; value: string }>;
} = {}) {
  const { imageProviderOverrides = {}, settingRows = [] } = options;

  const qaRunRepo = {
    ...makeRepository(),
    save: jest.fn().mockImplementation((e: unknown) =>
      Promise.resolve({ id: 'run-id', ...(e as object) }),
    ),
    create: jest.fn().mockImplementation((e: unknown) => e),
  };

  const qaPageRepo = {
    ...makeRepository(),
    save: jest.fn().mockImplementation((e: unknown) =>
      Promise.resolve(Array.isArray(e) ? e : { id: 'page-id', ...(e as object) }),
    ),
    create: jest.fn().mockImplementation((e: unknown) => e),
  };

  const settingsRepo = {
    ...makeRepository(),
    find: jest.fn().mockResolvedValue(settingRows),
  };

  const uploadService = {
    uploadGeneratedImage: jest.fn().mockResolvedValue(
      'http://localhost:3000/api/upload/files/regen.png',
    ),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AIQualityAssuranceService,
      { provide: IMAGE_GENERATION_PROVIDER, useValue: makeImageProvider(imageProviderOverrides) },
      { provide: UploadService, useValue: uploadService },
      { provide: getRepositoryToken(Story), useValue: makeRepository() },
      { provide: getRepositoryToken(StoryQaRun), useValue: qaRunRepo },
      { provide: getRepositoryToken(StoryQaPage), useValue: qaPageRepo },
      { provide: getRepositoryToken(PlatformSetting), useValue: settingsRepo },
      { provide: getRepositoryToken(Universe), useValue: makeRepository() },
      { provide: getRepositoryToken(CharacterCanon), useValue: makeRepository() },
    ],
  }).compile();

  const service = module.get<AIQualityAssuranceService>(AIQualityAssuranceService);
  const imageProvider = module.get(IMAGE_GENERATION_PROVIDER);

  return { service, imageProvider, qaRunRepo, qaPageRepo, storiesRepo: module.get(getRepositoryToken(Story)) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AIQualityAssuranceService', () => {
  describe('basic QA flow', () => {
    it('returns a result with confidence between 0 and 100', async () => {
      const { service } = await buildModule();
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(4), storyVisualState: null,
      });
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(100);
    });

    it('returns a valid status string', async () => {
      const { service } = await buildModule();
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2), storyVisualState: null,
      });
      expect(['pass', 'pass_with_warning', 'fail']).toContain(result.overallStatus);
    });

    it('returns one PageQaResult per input page', async () => {
      const { service } = await buildModule();
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(6), storyVisualState: null,
      });
      expect(result.pages.length).toBe(6);
      expect(result.finalPages.length).toBe(6);
    });

    it('returns topIssues as an array', async () => {
      const { service } = await buildModule();
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2), storyVisualState: null,
      });
      expect(Array.isArray(result.topIssues)).toBe(true);
    });
  });

  describe('identity QA — face comparison', () => {
    it('calls checkFaceConsistencyFromUrl once per page with imageUrl', async () => {
      const { service, imageProvider } = await buildModule();
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(4), storyVisualState: null,
      });
      expect(imageProvider.checkFaceConsistencyFromUrl).toHaveBeenCalledTimes(4);
    });

    it('passes hero.avatarUrl and page.imageUrl to face comparison', async () => {
      const { service, imageProvider } = await buildModule();
      const hero = makeHero({ avatarUrl: 'http://localhost:3000/api/upload/files/avatar-specific.png' });
      const pages = [makePage(1, { imageUrl: 'http://localhost:3000/api/upload/files/page-specific.png' })];
      await service.runStoryQA({ story: makeStory(), hero, heroCanon: null, pages, storyVisualState: null });
      expect(imageProvider.checkFaceConsistencyFromUrl).toHaveBeenCalledWith(
        'http://localhost:3000/api/upload/files/avatar-specific.png',
        'http://localhost:3000/api/upload/files/page-specific.png',
        'Siddhant',
      );
    });

    it('skips face comparison and returns identity=8 when hero has no avatarUrl', async () => {
      const { service, imageProvider } = await buildModule();
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero({ avatarUrl: null }), heroCanon: null,
        pages: makePages(2), storyVisualState: null,
      });
      expect(imageProvider.checkFaceConsistencyFromUrl).not.toHaveBeenCalled();
      expect(result.avgIdentityScore).toBe(8);
    });

    it('returns identity=0 for pages with no imageUrl', async () => {
      const { service, imageProvider } = await buildModule();
      const pages = makePages(2).map((p) => ({ ...p, imageUrl: undefined }));
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: pages as StoryPage[], storyVisualState: null,
      });
      expect(imageProvider.checkFaceConsistencyFromUrl).not.toHaveBeenCalled();
      expect(result.avgIdentityScore).toBe(0);
    });

    it('falls back to identity=7 when checkFaceConsistencyFromUrl returns null', async () => {
      const { service } = await buildModule({
        imageProviderOverrides: { checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue(null) },
      });
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(1), storyVisualState: null,
      });
      expect(result.avgIdentityScore).toBe(7);
    });

    it('falls back to identity=7 when checkFaceConsistencyFromUrl throws', async () => {
      const { service } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockRejectedValue(new Error('OpenAI timeout')),
        },
      });
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(1), storyVisualState: null,
      });
      expect(result.avgIdentityScore).toBe(7);
    });
  });

  describe('dialogue QA — speaker validation', () => {
    it('deducts for speech bubble with null speakerName', async () => {
      const { service } = await buildModule();
      const pages = [makePage(1, {
        speechBubbles: [
          { speakerName: null as unknown as string, text: 'Hello world!', bubbleStyle: 'normal' as const },
        ],
      })];
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null, pages, storyVisualState: null,
      });
      const page1 = result.pages.find((p) => p.pageNumber === 1)!;
      expect(page1.dialogueScore).toBeLessThan(10);
      expect(page1.issues.some((i) => i.includes('no valid speaker'))).toBe(true);
    });

    it('deducts for speech bubble with empty text', async () => {
      const { service } = await buildModule();
      const pages = [makePage(1, {
        speechBubbles: [{ speakerName: 'Siddhant', text: '', bubbleStyle: 'normal' as const }],
      })];
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null, pages, storyVisualState: null,
      });
      const page1 = result.pages.find((p) => p.pageNumber === 1)!;
      expect(page1.dialogueScore).toBeLessThan(10);
      expect(page1.issues.some((i) => i.includes('empty text'))).toBe(true);
    });

    it('flags narration that repeats dialogue verbatim', async () => {
      const spokenLine = 'I found the golden compass in the ancient cave forever!';
      const { service } = await buildModule();
      const pages = [makePage(1, {
        text: `Siddhant said "${spokenLine}" and ran ahead.`,
        speechBubbles: [{ speakerName: 'Siddhant', text: spokenLine, bubbleStyle: 'normal' as const }],
      })];
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null, pages, storyVisualState: null,
      });
      const page1 = result.pages.find((p) => p.pageNumber === 1)!;
      expect(page1.issues.some((i) => i.includes('narration repeats dialogue'))).toBe(true);
    });

    it('scores 10 for pages with no speech bubbles', async () => {
      const { service } = await buildModule();
      const pages = [makePage(1, { speechBubbles: [], dialogue: [] })];
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null, pages, storyVisualState: null,
      });
      const page1 = result.pages.find((p) => p.pageNumber === 1)!;
      expect(page1.dialogueScore).toBe(10);
    });
  });

  describe('expression QA', () => {
    it('deducts for expression mismatch (excited emotion, sad expression)', async () => {
      const { service } = await buildModule();
      const pages = [makePage(1, {
        speechBubbles: [
          { speakerName: 'Siddhant', text: 'Yes!', bubbleStyle: 'excited' as const, emotion: 'excited' },
        ],
        characterDirections: [
          { name: 'Siddhant', role: 'hero', expression: 'frowning deeply, downcast eyes', pose: 'standing' },
        ],
      })];
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null, pages, storyVisualState: null,
      });
      const page1 = result.pages.find((p) => p.pageNumber === 1)!;
      expect(page1.expressionScore).toBeLessThan(10);
    });

    it('returns 9 for pages with no character directions (safe default)', async () => {
      const { service } = await buildModule();
      const pages = [makePage(1, { characterDirections: [] })];
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null, pages, storyVisualState: null,
      });
      expect(result.pages[0].expressionScore).toBe(9);
    });
  });

  describe('story continuity QA', () => {
    it('deducts for missing narration text', async () => {
      const { service } = await buildModule();
      const pages = [makePage(1, { text: '' })];
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null, pages, storyVisualState: null,
      });
      expect(result.pages[0].storyScore).toBeLessThan(10);
    });

    it('scores 10 for page with proper narration and no costume change', async () => {
      const { service } = await buildModule();
      const pages = makePages(1);
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null, pages,
        storyVisualState: { costume: 'red jacket', companion: null, weapon: null, powers: [], inventory: [], transformation: null },
      });
      expect(result.pages[0].storyScore).toBe(10);
    });
  });

  describe('DB persistence', () => {
    it('saves QA run record to story_qa_runs', async () => {
      const { service, qaRunRepo } = await buildModule();
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(3), storyVisualState: null,
      });
      expect(qaRunRepo.save).toHaveBeenCalled();
    });

    it('saves one QA page record per story page', async () => {
      const { service, qaPageRepo } = await buildModule();
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(4), storyVisualState: null,
      });
      // Pages saved individually via Promise.all — one save call per page
      expect((qaPageRepo.save as jest.Mock).mock.calls.length).toBe(4);
    });
  });

  describe('auto-regeneration', () => {
    it('does NOT call generateImage when confidence >= minOverallConfidence', async () => {
      const { service, imageProvider } = await buildModule({
        settingRows: [
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '70' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
        ],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2), storyVisualState: null,
      });
      expect(imageProvider.generateImage).not.toHaveBeenCalled();
    });

    it('calls generateImage when identity < minIdentityScore AND confidence < minOverallConfidence', async () => {
      const { service, imageProvider } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 3, recommendation: 'regenerate', issues: ['face mismatch'],
          }),
        },
        settingRows: [
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '100' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
          { key: 'QA_MAX_RETRIES', value: '1' },
        ],
      });
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2),
        storyVisualState: { costume: 'red jacket', companion: null, weapon: null, powers: [], inventory: [], transformation: null },
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test scene' },
      });
      expect(imageProvider.generateImage).toHaveBeenCalled();
      expect(result.pagesRetried).toBeGreaterThan(0);
    });

    it('respects QA_MAX_RETRIES — pagesRetried <= pages * maxRetries', async () => {
      const { service, imageProvider } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 2, recommendation: 'regenerate', issues: [],
          }),
        },
        settingRows: [
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '100' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
          { key: 'QA_MAX_RETRIES', value: '1' },
        ],
      });
      const pages = makePages(3);
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages,
        storyVisualState: { costume: 'red jacket', companion: null, weapon: null, powers: [], inventory: [], transformation: null },
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test scene' },
      });
      expect(result.pagesRetried).toBeLessThanOrEqual(pages.length);
      expect(imageProvider.generateImage).toHaveBeenCalled();
    });

    it('does NOT call generateImage when QA_ENABLE_AUTO_REGENERATION is false', async () => {
      const { service, imageProvider } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 2, recommendation: 'regenerate', issues: [],
          }),
        },
        settingRows: [
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '100' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'false' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
        ],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2),
        storyVisualState: { costume: 'red jacket', companion: null, weapon: null, powers: [], inventory: [], transformation: null },
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test scene' },
      });
      expect(imageProvider.generateImage).not.toHaveBeenCalled();
    });
  });

  describe('QA skip / disabled mode', () => {
    it('returns confidence=100 and status=pass when QA_ENABLED=false', async () => {
      const { service, imageProvider } = await buildModule({
        settingRows: [{ key: 'QA_ENABLED', value: 'false' }],
      });
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(3), storyVisualState: null,
      });
      expect(result.overallConfidence).toBe(100);
      expect(result.overallStatus).toBe('pass');
      expect(imageProvider.checkFaceConsistencyFromUrl).not.toHaveBeenCalled();
    });
  });

  describe('QA_FORCE_REGENERATION setting', () => {
    it('regenerates all pages including accepted ones when QA_FORCE_REGENERATION=true', async () => {
      // Identity score is good (8) so pages would normally be accepted — force regen overrides this
      const { service, imageProvider } = await buildModule({
        settingRows: [
          { key: 'QA_FORCE_REGENERATION', value: 'true' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '0' }, // low threshold — only forceRegen drives retry
          { key: 'QA_MIN_IDENTITY_SCORE', value: '10' }, // high threshold so identity "fails" check
          { key: 'QA_MAX_RETRIES', value: '1' },
        ],
      });
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2),
        storyVisualState: null,
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test' },
      });
      expect(result.pagesRetried).toBeGreaterThan(0);
      expect(imageProvider.generateImage).toHaveBeenCalled();
    });

    it('does NOT regenerate extra pages when QA_FORCE_REGENERATION=false and confidence is high', async () => {
      const { service, imageProvider } = await buildModule({
        settingRows: [
          { key: 'QA_FORCE_REGENERATION', value: 'false' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '50' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
        ],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2), storyVisualState: null,
      });
      expect(imageProvider.generateImage).not.toHaveBeenCalled();
    });
  });

  describe('QA_DISABLE_QA_LOGGING setting', () => {
    it('skips DB write to story_qa_runs when QA_DISABLE_QA_LOGGING=true', async () => {
      const { service, qaRunRepo } = await buildModule({
        settingRows: [{ key: 'QA_DISABLE_QA_LOGGING', value: 'true' }],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(3), storyVisualState: null,
      });
      expect(qaRunRepo.save).not.toHaveBeenCalled();
    });

    it('skips DB write to story_qa_pages when QA_DISABLE_QA_LOGGING=true', async () => {
      const { service, qaPageRepo } = await buildModule({
        settingRows: [{ key: 'QA_DISABLE_QA_LOGGING', value: 'true' }],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(3), storyVisualState: null,
      });
      expect(qaPageRepo.save).not.toHaveBeenCalled();
    });

    it('persists DB records normally when QA_DISABLE_QA_LOGGING=false (default)', async () => {
      const { service, qaRunRepo, qaPageRepo } = await buildModule({
        settingRows: [{ key: 'QA_DISABLE_QA_LOGGING', value: 'false' }],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2), storyVisualState: null,
      });
      expect(qaRunRepo.save).toHaveBeenCalled();
      expect(qaPageRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('QA_MAX_RETRIES setting controls per-page retry attempts', () => {
    it('calls generateImage up to QA_MAX_RETRIES times for a failing page', async () => {
      // generateImage always fails so the loop must exhaust all retries
      const { service, imageProvider } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 1, recommendation: 'regenerate', issues: ['face mismatch'],
          }),
          generateImage: jest.fn().mockRejectedValue(new Error('provider error')),
        },
        settingRows: [
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '100' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
          { key: 'QA_MAX_RETRIES', value: '3' },
        ],
      });
      // single page to make the count deterministic
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(1),
        storyVisualState: { costume: 'red jacket', companion: null, weapon: null, powers: [], inventory: [], transformation: null },
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test scene' },
      });
      // 3 retries for 1 page → generateImage called exactly 3 times
      expect((imageProvider.generateImage as jest.Mock).mock.calls.length).toBe(3);
    });
  });

  describe('QA_RETRY_STRATEGY setting', () => {
    it('suppresses all regen when QA_RETRY_STRATEGY=never even if identity fails', async () => {
      const { service, imageProvider } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 1, recommendation: 'regenerate', issues: ['face mismatch'],
          }),
        },
        settingRows: [
          { key: 'QA_RETRY_STRATEGY', value: 'never' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '100' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
        ],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2),
        storyVisualState: null,
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test' },
      });
      expect(imageProvider.generateImage).not.toHaveBeenCalled();
    });

    it('allows regen when QA_RETRY_STRATEGY=page_only (default)', async () => {
      const { service, imageProvider } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 1, recommendation: 'regenerate', issues: ['face mismatch'],
          }),
        },
        settingRows: [
          { key: 'QA_RETRY_STRATEGY', value: 'page_only' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '100' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
          { key: 'QA_MAX_RETRIES', value: '1' },
        ],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(1),
        storyVisualState: { costume: 'red', companion: null, weapon: null, powers: [], inventory: [], transformation: null },
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test' },
      });
      expect(imageProvider.generateImage).toHaveBeenCalled();
    });
  });

  describe('QA_STOP_REGEN_ON_BUDGET and QA_MAX_COST_PER_STORY guardrails', () => {
    it('stops regen after budget is reached (QA_STOP_REGEN_ON_BUDGET=true)', async () => {
      // cost per regen = $0.011 (default). Budget = $0.01 → 0 regen images fit.
      const { service, imageProvider } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 1, recommendation: 'regenerate', issues: ['face mismatch'],
          }),
        },
        settingRows: [
          { key: 'QA_STOP_REGEN_ON_BUDGET', value: 'true' },
          { key: 'QA_MAX_COST_PER_STORY', value: '0.001' }, // less than one image cost
          { key: 'OPENAI_IMAGE_COST_PER_IMAGE', value: '0.011' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '100' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
          { key: 'QA_MAX_RETRIES', value: '3' },
        ],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(4),
        storyVisualState: { costume: 'red', companion: null, weapon: null, powers: [], inventory: [], transformation: null },
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test' },
      });
      // Budget of $0.001 < $0.011 per image → no images should be generated at all
      expect(imageProvider.generateImage).not.toHaveBeenCalled();
    });

    it('allows regen up to budget (one image fits, second is blocked)', async () => {
      // Budget = $0.015. One image at $0.011 fits. Second page should be blocked.
      const generateImage = jest.fn().mockResolvedValue({ imageUrl: 'http://localhost/regen.png' });
      const { service } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 1, recommendation: 'regenerate', issues: ['face mismatch'],
          }),
          generateImage,
        },
        settingRows: [
          { key: 'QA_STOP_REGEN_ON_BUDGET', value: 'true' },
          { key: 'QA_MAX_COST_PER_STORY', value: '0.015' },
          { key: 'OPENAI_IMAGE_COST_PER_IMAGE', value: '0.011' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '100' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
          { key: 'QA_MAX_RETRIES', value: '1' },
        ],
      });
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(3),
        storyVisualState: { costume: 'red', companion: null, weapon: null, powers: [], inventory: [], transformation: null },
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test' },
      });
      // Exactly 1 image generated (first page fits budget, subsequent pages blocked)
      expect(generateImage.mock.calls.length).toBe(1);
      expect(result.pagesRetried).toBe(1);
    });

    it('does not block regen when QA_STOP_REGEN_ON_BUDGET=false even if budget exceeded', async () => {
      const generateImage = jest.fn().mockResolvedValue({ imageUrl: 'http://localhost/regen.png' });
      const { service } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 1, recommendation: 'regenerate', issues: ['face mismatch'],
          }),
          generateImage,
        },
        settingRows: [
          { key: 'QA_STOP_REGEN_ON_BUDGET', value: 'false' },
          { key: 'QA_MAX_COST_PER_STORY', value: '0.001' }, // very low limit but guard disabled
          { key: 'OPENAI_IMAGE_COST_PER_IMAGE', value: '0.011' },
          { key: 'QA_ENABLE_AUTO_REGENERATION', value: 'true' },
          { key: 'QA_MIN_OVERALL_CONFIDENCE', value: '100' },
          { key: 'QA_MIN_IDENTITY_SCORE', value: '6' },
          { key: 'QA_MAX_RETRIES', value: '1' },
        ],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2),
        storyVisualState: { costume: 'red', companion: null, weapon: null, powers: [], inventory: [], transformation: null },
        imageGenerationInput: { heroName: 'Siddhant', heroAge: 8, sceneDescription: 'Test' },
      });
      // Budget guard disabled → both pages get retried
      expect(generateImage.mock.calls.length).toBe(2);
    });
  });

  describe('confidence calculation and status mapping', () => {
    it('returns "fail" status when identity score is very low', async () => {
      const { service } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 1, recommendation: 'reject', issues: ['face completely different'],
          }),
        },
      });
      // short narration also drives story score down
      const pages = makePages(2).map((p) => ({ ...p, text: 'x' }));
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: pages as StoryPage[], storyVisualState: null,
      });
      expect(result.overallConfidence).toBeLessThan(70);
      expect(result.overallStatus).toBe('fail');
    });

    it('returns "pass" status when identity is 10 and all scores high', async () => {
      const { service } = await buildModule({
        imageProviderOverrides: {
          checkFaceConsistencyFromUrl: jest.fn().mockResolvedValue({
            identityScore: 10, recommendation: 'accept', issues: [],
          }),
        },
      });
      const result = await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2), storyVisualState: null,
      });
      expect(result.overallStatus).toBe('pass');
    });
  });

  describe('prompt/analytics version tracking', () => {
    it('stores prompt version settings in the QA run record', async () => {
      const { service, qaRunRepo } = await buildModule({
        settingRows: [
          { key: 'QA_STORY_PROMPT_VERSION', value: '2.5' },
          { key: 'QA_IMAGE_PROMPT_VERSION', value: '1.3' },
          { key: 'QA_VERSION', value: '1.1' },
        ],
      });
      await service.runStoryQA({
        story: makeStory(), hero: makeHero(), heroCanon: null,
        pages: makePages(2), storyVisualState: null,
      });
      const savedRun = (qaRunRepo.save as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(savedRun.storyPromptVersion).toBe('2.5');
      expect(savedRun.imagePromptVersion).toBe('1.3');
      expect(savedRun.qaVersion).toBe('1.1');
    });
  });
});

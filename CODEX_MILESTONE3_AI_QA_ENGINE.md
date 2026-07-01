# Milestone 3 — AI Quality Assurance Engine

## One-liner for Codex

Implement Milestone 3 in `apps/api/` per this file: create `StoryQaRun` and `StoryQaPage` entities; add `overallConfidence` to `Story`, `characterConfidence`/`identityStability`/`storyConsistency` to `CharacterCanon`, and `avgConfidence` to `Universe`; add QA platform-setting defaults (`QA_ENABLED`, `QA_MIN_IDENTITY_SCORE`, `QA_MIN_STORY_SCORE`, `QA_MIN_OVERALL_CONFIDENCE`, `QA_MAX_RETRIES`, `QA_ENABLE_AUTO_REGENERATION`, and per-dimension enables + weights); create `AIQualityAssuranceService` in `apps/api/src/ai/ai-quality-assurance.service.ts` with `runStoryQA(story, hero, heroCanon, pages)` that runs identity, story, expression, dialogue, narration QA programmatically and composition QA via vision model, stores results, calculates `overallConfidence`, updates `Story.overallConfidence`, tracks character + universe confidence; integrate it in `generation.service.ts` after images are generated; add `GET /admin/qa/dashboard` in admin.controller.ts + admin.service.ts; add `AIQualityAssuranceModule` and wire everything into `AppModule`.

---

## Context

- **Monorepo**: `apps/api/` = NestJS, `apps/web/` = Next.js
- **ORM**: TypeORM with `synchronize: true` — new columns/tables auto-create
- **Existing face QA**: `ImageGenerationProvider.checkFaceConsistency(imageUrl, avatarUrl, heroName)` already exists in `openai-image.provider.ts`. It returns `{ identityScore: number; issues: string[]; recommendation: string }`. The generation service calls it per-page in both `generatePageImages` and `generateSceneImages`.
- **Existing QA settings**: `FACE_CONSISTENCY_QA_ENABLED` (bool) and `FACE_CONSISTENCY_THRESHOLD` (number, 1–10) already exist in `SETTING_DEFAULTS`.
- **No breaking changes**: all new Story/CharacterCanon/Universe columns are nullable. All new QA fields optional. Old stories work fine.

---

## Step 1 — New Platform-Setting Defaults

In `apps/api/src/admin/platform-setting.entity.ts`, add these entries to `SETTING_DEFAULTS`:

```ts
// AI Quality Assurance Engine (Milestone 3)
QA_ENABLED:                       { value: 'true',  type: 'boolean', description: 'Master toggle for the AI Quality Assurance Engine.' },
QA_ENABLE_AUTO_REGENERATION:      { value: 'true',  type: 'boolean', description: 'Automatically regenerate pages that fail QA below the minimum confidence threshold.' },
QA_ENABLE_IDENTITY_QA:            { value: 'true',  type: 'boolean', description: 'Enable identity QA (face resemblance check per page).' },
QA_ENABLE_STORY_QA:               { value: 'true',  type: 'boolean', description: 'Enable story continuity QA (costume/companion/power consistency).' },
QA_ENABLE_EXPRESSION_QA:          { value: 'true',  type: 'boolean', description: 'Enable expression QA (expression matches dialogue emotion).' },
QA_ENABLE_DIALOGUE_QA:            { value: 'true',  type: 'boolean', description: 'Enable dialogue QA (speaker validity, no duplicates).' },
QA_ENABLE_COMPOSITION_QA:         { value: 'false', type: 'boolean', description: 'Enable AI vision composition QA (expensive — vision model per image). Off by default.' },
QA_ENABLE_NARRATION_QA:           { value: 'true',  type: 'boolean', description: 'Enable narration QA (audio presence + duration check).' },
QA_MIN_IDENTITY_SCORE:            { value: '6',     type: 'number',  description: 'Minimum identity score (0–10) for a page to pass Identity QA.' },
QA_MIN_STORY_SCORE:               { value: '6',     type: 'number',  description: 'Minimum story continuity score (0–10) for a page to pass Story QA.' },
QA_MIN_EXPRESSION_SCORE:          { value: '5',     type: 'number',  description: 'Minimum expression score (0–10) for a page to pass Expression QA.' },
QA_MIN_OVERALL_CONFIDENCE:        { value: '70',    type: 'number',  description: 'Minimum overall confidence (0–100) before auto-regeneration is triggered.' },
QA_MAX_RETRIES:                   { value: '2',     type: 'number',  description: 'Maximum auto-regeneration attempts per failed page.' },
QA_WEIGHT_IDENTITY:               { value: '40',    type: 'number',  description: 'Weight of Identity QA in the overall confidence score (%).' },
QA_WEIGHT_STORY:                  { value: '20',    type: 'number',  description: 'Weight of Story QA in overall confidence (%).' },
QA_WEIGHT_EXPRESSION:             { value: '10',    type: 'number',  description: 'Weight of Expression QA in overall confidence (%).' },
QA_WEIGHT_DIALOGUE:               { value: '10',    type: 'number',  description: 'Weight of Dialogue QA in overall confidence (%).' },
QA_WEIGHT_COMPOSITION:            { value: '10',    type: 'number',  description: 'Weight of Composition QA in overall confidence (%).' },
QA_WEIGHT_NARRATION:              { value: '5',     type: 'number',  description: 'Weight of Narration QA in overall confidence (%).' },
QA_WEIGHT_STATE_CONSISTENCY:      { value: '5',     type: 'number',  description: 'Weight of Story State Consistency QA in overall confidence (%).' },
QA_STORY_PROMPT_VERSION:          { value: '1.0',   type: 'string',  description: 'Story prompt version tag — increment to track prompt improvements.' },
QA_IMAGE_PROMPT_VERSION:          { value: '1.0',   type: 'string',  description: 'Image prompt version tag.' },
QA_VERSION:                       { value: '1.0',   type: 'string',  description: 'QA engine version tag.' },
```

---

## Step 2 — New Entities

### 2a. `StoryQaRun` entity

File: `apps/api/src/ai/entities/story-qa-run.entity.ts`

```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('story_qa_runs')
export class StoryQaRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  // Prompt/model versions at time of generation
  @Column({ type: 'text', nullable: true })
  storyModel!: string | null;

  @Column({ type: 'text', nullable: true })
  imageModel!: string | null;

  @Column({ type: 'text', nullable: true })
  ttsModel!: string | null;

  @Column({ type: 'text', nullable: true })
  storyPromptVersion!: string | null;

  @Column({ type: 'text', nullable: true })
  imagePromptVersion!: string | null;

  @Column({ type: 'text', nullable: true })
  qaVersion!: string | null;

  // Aggregate scores (0–10 each, overall 0–100)
  @Column({ type: 'float', nullable: true })
  avgIdentityScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgStoryScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgExpressionScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgDialogueScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgCompositionScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgNarrationScore!: number | null;

  @Column({ type: 'float', nullable: true })
  overallConfidence!: number | null;

  @Column({ type: 'text', default: 'pending' })
  overallStatus!: 'pending' | 'pass' | 'pass_with_warning' | 'fail';

  @Column({ type: 'integer', default: 0 })
  pagesRetried!: number;

  // Top-level issue summary
  @Column({ type: 'jsonb', nullable: true })
  topIssues!: string[] | null;

  // Cost tracking (USD)
  @Column({ type: 'float', nullable: true })
  storyCostUsd!: number | null;

  @Column({ type: 'float', nullable: true })
  imageCostUsd!: number | null;

  @Column({ type: 'float', nullable: true })
  ttsCostUsd!: number | null;

  @Column({ type: 'integer', nullable: true })
  generationTimeMs!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
```

### 2b. `StoryQaPage` entity

File: `apps/api/src/ai/entities/story-qa-page.entity.ts`

```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('story_qa_pages')
export class StoryQaPage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  storyQaRunId!: string;

  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'integer' })
  pageNumber!: number;

  // Per-dimension scores (0–10)
  @Column({ type: 'float', nullable: true })
  identityScore!: number | null;

  @Column({ type: 'float', nullable: true })
  storyScore!: number | null;

  @Column({ type: 'float', nullable: true })
  expressionScore!: number | null;

  @Column({ type: 'float', nullable: true })
  dialogueScore!: number | null;

  @Column({ type: 'float', nullable: true })
  compositionScore!: number | null;

  @Column({ type: 'float', nullable: true })
  narrationScore!: number | null;

  @Column({ type: 'float', nullable: true })
  overallScore!: number | null;

  @Column({ type: 'boolean', default: true })
  accepted!: boolean;

  @Column({ type: 'integer', default: 0 })
  retryCount!: number;

  @Column({ type: 'jsonb', nullable: true })
  issues!: string[] | null;

  @Column({ type: 'text', nullable: true })
  acceptedImageUrl!: string | null;

  @Column({ type: 'float', nullable: true })
  imageCostUsd!: number | null;

  @Column({ type: 'float', nullable: true })
  ttsCostUsd!: number | null;

  @Column({ type: 'integer', nullable: true })
  generationTimeMs!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
```

---

## Step 3 — New Columns on Existing Entities

### 3a. `Story` entity (`apps/api/src/stories/story.entity.ts`)

Add before `createdAt`:

```ts
@Column({ type: 'float', nullable: true })
overallConfidence!: number | null;
```

### 3b. `CharacterCanon` entity (`apps/api/src/characters/entities/character-canon.entity.ts`)

Read the file first to find the right insertion point. Add these columns before `createdAt`:

```ts
// QA-derived confidence metrics (updated after each story generation)
@Column({ type: 'float', nullable: true })
avatarQuality!: number | null;          // 0–100: quality of the source avatar for generation

@Column({ type: 'float', nullable: true })
identityStability!: number | null;      // 0–100: rolling avg of identity scores across stories

@Column({ type: 'float', nullable: true })
storyConsistency!: number | null;       // 0–100: how consistently the character appears in stories

@Column({ type: 'float', nullable: true })
characterConfidence!: number | null;    // 0–100: overall character confidence
```

### 3c. `Universe` entity (`apps/api/src/universes/universe.entity.ts`)

Add before `createdAt`:

```ts
@Column({ type: 'float', nullable: true })
avgConfidence!: number | null;          // 0–100: rolling avg confidence across all stories in universe
```

---

## Step 4 — `AIQualityAssuranceService`

Create `apps/api/src/ai/ai-quality-assurance.service.ts`.

### 4a. Interfaces

```ts
export interface PageQaResult {
  pageNumber: number;
  identityScore: number;        // 0–10
  storyScore: number;           // 0–10
  expressionScore: number;      // 0–10
  dialogueScore: number;        // 0–10
  compositionScore: number;     // 0–10
  narrationScore: number;       // 0–10
  overallScore: number;         // 0–10 weighted avg
  issues: string[];
  accepted: boolean;
  retryCount: number;
  imageCostUsd: number;
  ttsCostUsd: number;
  acceptedImageUrl: string | null;
}

export interface StoryQaResult {
  overallConfidence: number;    // 0–100
  overallStatus: 'pass' | 'pass_with_warning' | 'fail';
  pages: PageQaResult[];
  avgIdentityScore: number;
  avgStoryScore: number;
  avgExpressionScore: number;
  avgDialogueScore: number;
  avgCompositionScore: number;
  avgNarrationScore: number;
  pagesRetried: number;
  topIssues: string[];
}
```

### 4b. QA methods — implementation rules

**Identity QA per page** (`scoreIdentity`):
- If no `imageUrl` → score 0, issue "no image generated"
- If no `avatarUrl` (hero has no approved avatar) → score 8 (neutral — can't verify), no issues
- Otherwise call `this.imageProvider.checkFaceConsistency(imageUrl, avatarUrl, heroName)` (existing method, already returns `identityScore`)
- Map the returned identityScore directly (it's already 0–10)
- Cost: add nothing (already tracked in generation cost)

**Story continuity QA per page** (`scoreStory`):
- Compares expected state (from `storyStateSnapshot`) against the visual state that was supposed to carry forward
- Check: if page has `storyStateSnapshot` but it contradicts the running tracker, score down
- Programmatic checks — no AI call needed
- Start at 10.0, subtract:
  - 1.0 if costume present in visualState but missing from storyStateSnapshot
  - 1.0 if companion present in visualState but missing from storyStateSnapshot
  - 2.0 if page text is empty
  - 1.0 if page number is missing
  - 1.5 if storyStateSnapshot shows location but it's the same as the previous page (stagnant setting) for 3+ consecutive pages
- Floor at 0

**Expression QA per page** (`scoreExpression`):
- For each characterDirection, check if expression matches the emotion of their speechBubble
- Emotion keyword matching (case-insensitive):
  - "excited", "happy", "joyful" → expected expression contains "smil" or "bright" or "excit"
  - "sad", "cry", "upset" → expected expression contains "sad" or "frown" or "tears"
  - "scared", "afraid", "fear" → expected expression contains "fear" or "wide" or "scared"
  - "angry", "furious" → expected expression contains "angry" or "frown" or "furrowed"
  - "surprised" → expected expression contains "surprised" or "wide"
  - "determined", "focused" → expression contains "determin" or "focus" or "resolv"
- No match deductions: -1.5 per mismatch, floor at 5
- If page has no characterDirections → 8 (neutral)
- If no speechBubbles on page → 9 (neutral)

**Dialogue QA per page** (`scoreDialogue`):
- Start at 10
- For each speechBubble:
  - -2 if speakerName is empty or "undefined" or "null"
  - -1 if text is empty
  - -1.5 if the same text appears in another speechBubble on the same page
- For narration: -1 if `page.text` contains the exact verbatim text of any speechBubble (duplication)
- Floor at 0

**Composition QA per page** (`scoreComposition`):
- If `QA_ENABLE_COMPOSITION_QA` is false → return 8 (neutral, not evaluated)
- If enabled: call Gemini vision (or GPT-4o-mini vision) with the image URL + this prompt:
  ```
  Analyze this story illustration for quality. Score each aspect 1-10:
  1. Face visibility (hero's face clearly visible, not cropped)
  2. No text/words in the image
  3. Correct character count (expected: {expectedCharacterCount})
  4. Natural anatomy (no extra fingers, floating objects, distorted limbs)
  5. Background coherence
  Return JSON: {"faceVisibility":N,"noText":N,"characterCount":N,"anatomy":N,"background":N,"overallScore":N,"issues":["..."]}
  ```
- Average the scores, return result
- If vision call fails → return 7 (neutral)

**Narration QA per page** (`scoreNarration`):
- If page has `audioUrl` → 9
- If page has `text` and `text.length > 10` but no audioUrl, and ENABLE_NARRATION is true → 5, issue "narration missing"
- If ENABLE_NARRATION is false → 10 (not applicable)
- If `text.length < 20` → 7, issue "narration text very short"

### 4c. Overall confidence calculation

```ts
function calculateOverallConfidence(pages: PageQaResult[], weights: QaWeights): number {
  if (pages.length === 0) return 0;
  const avg = (scores: number[]) => scores.reduce((a, b) => a + b, 0) / scores.length;
  const identity    = avg(pages.map(p => p.identityScore));
  const story       = avg(pages.map(p => p.storyScore));
  const expression  = avg(pages.map(p => p.expressionScore));
  const dialogue    = avg(pages.map(p => p.dialogueScore));
  const composition = avg(pages.map(p => p.compositionScore));
  const narration   = avg(pages.map(p => p.narrationScore));
  const stateConsistency = story; // reuse story score for state consistency weight

  const totalWeight = weights.identity + weights.story + weights.expression
    + weights.dialogue + weights.composition + weights.narration + weights.stateConsistency;

  const raw = (
    identity    * weights.identity +
    story       * weights.story +
    expression  * weights.expression +
    dialogue    * weights.dialogue +
    composition * weights.composition +
    narration   * weights.narration +
    stateConsistency * weights.stateConsistency
  ) / totalWeight;

  return Math.round(raw * 10); // 0–100
}
```

### 4d. `runStoryQA` method signature

```ts
async runStoryQA(params: {
  story: Story;
  hero: Hero;
  heroCanon: CharacterCanon | null;
  pages: StoryPage[];
  storyVisualState: StoryVisualState | null;
  startedAt: Date;
}): Promise<StoryQaResult>
```

- Load QA settings from platform_settings
- For each page, run all enabled QA checks concurrently (use `Promise.all`)
- Identity check uses `this.imageProvider.checkFaceConsistency` with hero.avatarUrl
- After scoring all pages, calculate `overallConfidence`
- Persist `StoryQaRun` + one `StoryQaPage` per page
- Update `story.overallConfidence = result.overallConfidence`
- If `QA_ENABLE_AUTO_REGENERATION` and confidence < `QA_MIN_OVERALL_CONFIDENCE`, trigger `autoRegenerate` for failed pages (up to `QA_MAX_RETRIES`)

### 4e. Auto-regeneration

```ts
private async autoRegeneratePage(params: {
  story: Story;
  page: StoryPage;
  hero: Hero;
  heroCanon: CharacterCanon | null;
  storyVisualState: StoryVisualState | null;
  retryCount: number;
  failureReason: 'identity' | 'composition' | 'expression';
}): Promise<StoryPage>
```

- Build a regeneration image input with a stronger prompt
- For identity failures, add this extra instruction to the image prompt:
  ```
  IDENTITY CRITICAL: The previous illustration failed identity verification.
  The child must closely resemble the approved Character Canon.
  Preserve: face shape, skin tone, hairstyle, eye shape, smile, age, distinctive facial features.
  Do NOT redesign the child. Do NOT create generic cartoon anatomy. Stylize the artwork only.
  ```
- Call `this.imageProvider.generateImage(input)` once
- Return updated page with new imageUrl
- Respect `QA_MAX_RETRIES` — never regenerate endlessly

---

## Step 5 — `AIQualityAssuranceModule`

Create `apps/api/src/ai/ai-quality-assurance.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharacterCanon } from '../characters/entities/character-canon.entity';
import { Story } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { PlatformSetting } from '../admin/platform-setting.entity';
import { StoryQaRun } from './entities/story-qa-run.entity';
import { StoryQaPage } from './entities/story-qa-page.entity';
import { AIQualityAssuranceService } from './ai-quality-assurance.service';
import { AiModule } from './ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoryQaRun, StoryQaPage, Story, CharacterCanon, Universe, PlatformSetting]),
    AiModule,
  ],
  providers: [AIQualityAssuranceService],
  exports: [AIQualityAssuranceService],
})
export class AIQualityAssuranceModule {}
```

Register in `AppModule` imports.

---

## Step 6 — Wire into `GenerationService`

In `apps/api/src/generation/generation.service.ts`:

1. Import and inject `AIQualityAssuranceService`
2. In `generateStory()`, after narration is generated and pages are saved, add:

```ts
if (await this.getBooleanSetting('QA_ENABLED', true)) {
  const qaStartedAt = new Date();
  try {
    await this.qaService.runStoryQA({
      story,
      hero,
      heroCanon,
      pages: story.pages,
      storyVisualState,
      startedAt: qaStartedAt,
    });
    // reload story to pick up any auto-regenerated page imageUrls + overallConfidence
    const refreshed = await this.storiesRepo.findOne({ where: { id: storyId } });
    if (refreshed) Object.assign(story, refreshed);
  } catch (err) {
    this.logger.warn('QA engine non-fatal error', err);
  }
}
```

3. Inject `AIQualityAssuranceService` in the constructor (after adding it to `GenerationModule` imports).

Update `GenerationModule` to import `AIQualityAssuranceModule`.

---

## Step 7 — Admin Dashboard Endpoint

In `apps/api/src/admin/admin.service.ts`, add `getQaDashboard()`:

```ts
async getQaDashboard(params: { days?: number } = {}): Promise<{
  totalRuns: number;
  avgOverallConfidence: number;
  avgIdentityScore: number;
  avgStoryScore: number;
  avgExpressionScore: number;
  avgDialogueScore: number;
  avgCompositionScore: number;
  avgNarrationScore: number;
  passRate: number;             // % of runs with overallStatus = 'pass'
  retryRate: number;            // % of runs with pagesRetried > 0
  storiesAcceptedFirstAttempt: number;
  storiesRequiringRetry: number;
  failedPages: number;
  recentRuns: Array<{
    id: string;
    storyId: string;
    storyTitle: string | null;
    userEmail: string | null;
    overallConfidence: number | null;
    overallStatus: string;
    avgIdentityScore: number | null;
    pagesRetried: number;
    createdAt: Date;
  }>;
  topFailureReasons: Array<{ reason: string; count: number }>;
  confidenceTrend: Array<{ date: string; avgConfidence: number; count: number }>;
}>
```

Query `story_qa_runs` + join `stories` + `users` for the last `days` days (default 30).

In `apps/api/src/admin/admin.controller.ts`, add:

```ts
@Get('qa/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async getQaDashboard(@Query('days') days?: string) {
  const data = await this.adminService.getQaDashboard({ days: days ? Number(days) : 30 });
  return { data };
}
```

---

## Step 8 — Character + Universe Confidence Tracking

In `AIQualityAssuranceService.runStoryQA`, after persisting the run:

**Character confidence**:
```ts
if (heroCanon) {
  const identityScores = pages.map(p => p.identityScore);
  const newAvg = identityScores.reduce((a, b) => a + b, 0) / identityScores.length;
  const prevStability = heroCanon.identityStability ?? newAvg * 10;
  // Exponential moving average with alpha = 0.3
  const updatedStability = prevStability * 0.7 + newAvg * 10 * 0.3;
  const characterConfidence = (
    (heroCanon.avatarQuality ?? 80) * 0.3 +
    updatedStability * 0.4 +
    (result.avgStoryScore * 10) * 0.3
  );
  await this.canonRepo.update(heroCanon.id, {
    identityStability: Math.round(updatedStability * 10) / 10,
    storyConsistency: Math.round(result.avgStoryScore * 10),
    characterConfidence: Math.round(characterConfidence * 10) / 10,
  });
}
```

**Universe confidence**:
```ts
if (story.universeId) {
  // Compute rolling avg of overallConfidence across last 20 completed stories in universe
  const recentConfidences = await this.storiesRepo.find({
    where: { universeId: story.universeId, status: StoryStatus.Completed },
    order: { createdAt: 'DESC' },
    take: 20,
    select: ['overallConfidence'],
  });
  const valid = recentConfidences.filter(s => s.overallConfidence !== null).map(s => s.overallConfidence!);
  if (valid.length > 0) {
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    await this.universesRepo.update(story.universeId, { avgConfidence: Math.round(avg * 10) / 10 });
  }
}
```

---

## Step 9 — Register New Entities in TypeORM

In `apps/api/src/app.module.ts`, add to the TypeORM entity list:
- `StoryQaRun`
- `StoryQaPage`

(All other entity imports are automatic via auto-import glob or explicit list — check existing pattern.)

---

## Step 10 — Admin Debug Endpoint for Stories

In `apps/api/src/admin/admin.controller.ts`, add (if not already created by Milestone 2 Codex):

```ts
@Get('stories/:id/debug')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
async getStoryDebug(@Param('id') id: string) {
  const data = await this.adminService.getStoryDebug(id);
  return { data };
}
```

In `admin.service.ts`, add `getStoryDebug(id)`:
- Fetch story with relations (user, hero)
- Return `{ pages: story.pages, storyVisualState: story.storyVisualState }`
  (pages already contain characterDirections, speechBubbles, storyStateSnapshot from M2)

---

## Acceptance Criteria

- [ ] `story_qa_runs` and `story_qa_pages` tables created automatically via TypeORM sync
- [ ] `stories.overall_confidence` column added
- [ ] `character_canons.identity_stability`, `.story_consistency`, `.character_confidence` columns added
- [ ] `universes.avg_confidence` column added
- [ ] 22 new QA platform settings in `SETTING_DEFAULTS`
- [ ] `AIQualityAssuranceService.runStoryQA()` runs after every story generation when `QA_ENABLED=true`
- [ ] Identity QA uses existing `checkFaceConsistency` per page
- [ ] Story, Expression, Dialogue, Narration QA are programmatic (no extra AI cost)
- [ ] Composition QA is behind `QA_ENABLE_COMPOSITION_QA` flag (off by default)
- [ ] Auto-regeneration runs for failed pages when `QA_ENABLE_AUTO_REGENERATION=true`
- [ ] Identity failure regeneration uses stronger identity-lock prompt
- [ ] `GET /admin/qa/dashboard` returns aggregate metrics
- [ ] `GET /admin/stories/:id/debug` returns page-level debug data
- [ ] TypeScript compiles clean: `npx tsc --noEmit` in `apps/api/`
- [ ] No breaking changes to existing story generation flow

# HeroKids Universe — Phase 2: Smart Illustration Engine (Backend)

## Audit: What to Reuse vs Change

**REUSE AS-IS (do not touch):**
- `generateImageWithRetry()` — same retry logic, just called per scene instead of per page
- `mapWithConcurrency()` — same concurrency helper
- `aiUsageLogsRepo` cost logging — same pattern, just one log per scene
- `uploadService.uploadGeneratedImage()` — same upload, use scene's first page number as the file key
- `openai-image.provider.ts` — no changes needed; scene illustration is just a different prompt
- `generatePageAudio()` — no changes; TTS still operates per-page text
- Phase 1 identity/costume system — `storyVisualState`, `characterIdentity`, `heroAvatarDescription` — reuse completely
- `persistUniverseExtracts()`, `buildUniverseContext()`, `ensureHeroAvatarDescription()`, `ensureHeroCharacterIdentity()` — reuse

**CHANGE:**
- `normalizeGeneratedStory()` — extend to handle `scenes[]` from Gemini
- `generatePageImages()` — keep as fallback, add new `generateSceneImages()` that calls the same `generateImageWithRetry()`
- `generateStory()` main orchestration — choose scene-based or page-based depending on Gemini output
- `story.entity.ts` — add `scenes` JSONB and `sceneId`/`cropHint` to `StoryPage`
- `story-generation.provider.ts` — add `SceneOutput` and update `StoryGenerationOutput`
- `gemini-story.provider.ts` — update prompt to output `scenes[]` instead of flat `pages[]`

---

## 1. Update `story.entity.ts`

### Add to `StoryPage` interface:

```typescript
export interface StoryPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  sceneDescription?: string;
  dialogue?: PageDialogue[];
  characters?: PageCharacter[];
  camera?: string;
  cropHint?: string;   // NEW: e.g. "full_width", "zoom_hero", "zoom_companion", "zoom_center", "close_up", "wide_cinematic"
  sceneId?: string;    // NEW: which StoryScene this page belongs to
  background?: string;
}
```

### Add new `StoryScene` interface and column:

```typescript
export interface StoryScene {
  sceneId: string;           // e.g. "scene-1"
  title: string;             // e.g. "Arrival at the Caves"
  illustrationUrl: string | null;  // the single AI-generated image for this scene
  illustrationBrief: string; // the prompt that was sent to the image model
  pageNumbers: number[];     // which page numbers share this illustration
}
```

Add column to `Story` entity class:

```typescript
@Column({ type: 'jsonb', nullable: true })
scenes!: StoryScene[] | null;
```

---

## 2. Update `story-generation.provider.ts`

Add `SceneOutput` interface and update `StoryGenerationOutput`:

```typescript
export interface SceneOutput {
  sceneId: string;
  title: string;
  illustrationBrief: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    sceneDescription: string;
    dialogue?: PageDialogue[];
    characters?: PageCharacter[];
    camera?: string;
    cropHint?: string;
    background?: string;
  }>;
}

// Add to StoryGenerationOutput:
export interface StoryGenerationOutput {
  title: string;
  cliffhanger?: string;
  storyVisualState?: StoryVisualStateOutput;
  scenes?: SceneOutput[];    // NEW — Phase 2 scene grouping
  newPowers?: string[];
  newQuests?: string[];
  newMemories?: Array<{ type: string; title: string; detail?: string }>;
  pages: Array<{ /* existing */ }>;  // KEEP for backward compatibility; may be empty if scenes present
  provider?: string;
  model?: string;
  prompt?: string;
  rawResponse?: string;
  inputTokens?: number;
  outputTokens?: number;
}
```

---

## 3. Update Gemini Prompt

### `apps/api/src/ai/providers/gemini-story.provider.ts` — `buildPrompt()`

**Replace** the current JSON output schema section. The prompt should now ask Gemini to group pages into scenes.

Add these scene grouping rules **before** the JSON schema section:

```
SCENE GROUPING RULES:
- Group all ${n} pages into exactly ${sceneCount} scenes. Do not create more or fewer.
- Each scene covers consecutive pages (scene 1 = pages 1-2, scene 2 = pages 3-5, etc.).
- A new scene begins only when: location changes significantly, time jumps, or a major new element appears.
- Every scene must cover at least 2 consecutive pages.
- Scene 1 must be the most visually striking — it doubles as the story cover.
- Within a scene, pages share ONE illustration. So sceneDescription on all pages must be consistent with the same moment.

ILLUSTRATION BRIEF RULES (for the illustrationBrief field):
- Start with composition style: "WIDE CINEMATIC:" or "DYNAMIC ACTION:" or "INTIMATE SCENE:"
- Describe every character's position: "hero positioned left-center", "companion hovering right"
- Request extra background space: "with ample sky/ground/environment for crop flexibility"
- Include exact costume from Story Visual State
- Include mood and lighting (e.g., "warm golden hour light")
- End with: "No text, no speech bubbles, characters with safe margins from edges."
- Length: 3-5 sentences max.

CROP HINT OPTIONS (use for each page's cropHint field):
- "full_width" — default, show full scene; always use on the FIRST page of a scene
- "zoom_hero" — zoom in on hero's position in the scene
- "zoom_companion" — zoom toward companion's position
- "zoom_center" — slight zoom to center of scene
- "wide_cinematic" — letterbox crop for dramatic wide shots
- "close_up" — tight crop on hero's face/expression
Use "full_width" for the first page of each scene. Use zoom variants for subsequent pages in the same scene to create variety.
```

**Scene count calculation** — add this helper logic before building the prompt:

```typescript
const sceneCount = n <= 6 ? 2 : n <= 8 ? 3 : n <= 10 ? 4 : 4;
```

**Replace** the JSON output schema with:

```typescript
const pageEntriesPerScene = (pagesInScene: number[], sceneNum: number) =>
  pagesInScene.map(pageNum =>
    `      {
        "pageNumber": ${pageNum},
        "text": "...",
        "sceneDescription": "...",
        "background": "...",
        "camera": "...",
        "cropHint": "${pageNum === pagesInScene[0] ? 'full_width' : 'zoom_hero'}",
        "characters": [{ "name": "${heroRef}", "expression": "...", "pose": "..." }],
        "dialogue": []
      }`
  ).join(',\n');

// Distribute pages evenly across scenes
const pagesPerScene: number[][] = [];
const pagesPerSceneSize = Math.ceil(n / sceneCount);
for (let s = 0; s < sceneCount; s++) {
  const start = s * pagesPerSceneSize + 1;
  const end = Math.min((s + 1) * pagesPerSceneSize, n);
  pagesPerScene.push(Array.from({ length: end - start + 1 }, (_, i) => start + i));
}

const sceneEntries = pagesPerScene.map((pages, i) => `    {
      "sceneId": "scene-${i + 1}",
      "title": "Scene Title ${i + 1}",
      "illustrationBrief": "WIDE CINEMATIC: [full illustration description with characters, costume, setting, lighting, positioning, ample background space, no text]",
      "pages": [
${pageEntriesPerScene(pages, i + 1)}
      ]
    }`).join(',\n');
```

The final JSON response schema:

```
Respond with ONLY valid JSON (no markdown, no code fences):
{
  "title": "Story title",
  "cliffhanger": "One sentence hinting at the next adventure",
  "storyVisualState": {
    "costume": "...",
    "companion": "...",
    "weapon": "...",
    "powers": [],
    "inventory": []
  },
  "newPowers": [],
  "newQuests": [],
  "newMemories": [],
  "scenes": [
${sceneEntries}
  ],
  "pages": []
}

IMPORTANT: The "pages" array MUST be empty []. All pages must be inside "scenes". This is required.
newMemories type must be one of: character_met, villain_defeated, power_earned, item_found, location_discovered, quest_opened, quest_completed, achievement_unlocked
```

---

## 4. Update `normalizeGeneratedStory()` in `generation.service.ts`

Extend the existing method to handle scenes:

```typescript
private normalizeGeneratedStory(
  generated: StoryGenerationOutput,
  heroName: string,
  existingVisualState: StoryVisualState | null,
): StoryGenerationOutput {
  const normalizePage = (page: { pageNumber: number; text: string; sceneDescription: string; dialogue?: PageDialogue[]; characters?: PageCharacter[]; camera?: string; cropHint?: string; background?: string }) => ({
    ...page,
    dialogue: page.dialogue ?? [],
    characters: page.characters?.length
      ? page.characters
      : [{ name: heroName, expression: 'focused', pose: 'in action' }],
    camera: page.camera ?? 'medium shot',
    background: page.background ?? page.sceneDescription,
    cropHint: page.cropHint ?? 'full_width',
  });

  // Normalize scenes if present
  const normalizedScenes = generated.scenes?.map((scene) => ({
    ...scene,
    illustrationBrief: scene.illustrationBrief || scene.pages[0]?.sceneDescription || 'Wide cinematic illustration',
    pages: scene.pages.map(normalizePage),
  }));

  // Flatten scenes into pages array if scenes present and pages array is empty
  const flatPages = normalizedScenes?.length
    ? normalizedScenes.flatMap((scene) =>
        scene.pages.map((p) => ({ ...p, sceneDescription: p.sceneDescription ?? scene.illustrationBrief }))
      ).sort((a, b) => a.pageNumber - b.pageNumber)
    : generated.pages.map(normalizePage);

  return {
    ...generated,
    storyVisualState: generated.storyVisualState ?? (existingVisualState
      ? {
          costume: existingVisualState.costume,
          companion: existingVisualState.companion,
          weapon: existingVisualState.weapon,
          powers: existingVisualState.powers,
          inventory: existingVisualState.inventory,
        }
      : undefined),
    scenes: normalizedScenes,
    pages: flatPages,
  };
}
```

---

## 5. Add `generateSceneImages()` to `generation.service.ts`

Add this new private method. It follows the exact same pattern as `generatePageImages()` but iterates over scenes instead of pages:

```typescript
private async generateSceneImages(
  story: Story,
  hero: Hero,
  heroName: string,
  heroAge: number,
  generated: StoryGenerationOutput,
  supportingCharacters: string[],
  characterAvatarUrls: string[],
  characterAvatarDescriptions: string[],
  isSandbox: boolean,
  storyVisualState: StoryVisualState | null,
  onPageDone?: (pageNum: number, total: number) => Promise<void>,
): Promise<{ pages: StoryPage[]; scenes: StoryScene[]; totalCostUsd: number }> {
  const scenes = generated.scenes!;
  const imageModel = this.config.get<string>('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
  const costPerImage = await this.getNumberSetting('OPENAI_IMAGE_COST_PER_IMAGE', Number(SETTING_DEFAULTS['OPENAI_IMAGE_COST_PER_IMAGE'].value));
  let totalCostUsd = 0;
  let settled = 0;

  const mode = this.config.get<string>('IMAGE_GENERATION_MODE') ?? 'full_generation';
  const maxScenes = mode === 'story_only'
    ? 0
    : mode === 'story_plus_cover'
      ? 1
      : scenes.length;

  type SceneResult = { scene: SceneOutput; imageOutput: ImageGenerationOutput | null; error?: string };

  const illustratedScenes = scenes.slice(0, maxScenes);
  const remainingScenes   = scenes.slice(maxScenes);

  // Generate one illustration per scene — reuses generateImageWithRetry unchanged
  const sceneResults: SceneResult[] = await this.mapWithConcurrency(
    illustratedScenes,
    2,
    async (scene): Promise<SceneResult> => {
      try {
        // Use first page's characters for character direction in the illustration
        const firstPage = scene.pages[0];
        const imageOutput = await this.generateImageWithRetry({
          sceneDescription: scene.illustrationBrief,
          heroName,
          heroAge,
          supportingCharacters,
          heroAvatarUrl: hero.avatarUrl ?? undefined,
          heroAvatarDescription: hero.avatarDescription ?? undefined,
          characterAvatarUrls,
          characterAvatarDescriptions,
          style: 'premium wide-format cinematic children\'s storybook illustration, warm semi-realistic cartoon art, expressive but recognisable faces, rich colorful environments with ample background space, Indian family storybook warmth',
          storyVisualState: storyVisualState ?? undefined,
          characters: firstPage?.characters,
          camera: 'wide cinematic composition, characters positioned with generous background space on all sides for flexible cropping',
        });
        settled++;
        if (onPageDone) await onPageDone(settled, illustratedScenes.length).catch(() => {});
        return { scene, imageOutput };
      } catch (err) {
        settled++;
        if (onPageDone) await onPageDone(settled, illustratedScenes.length).catch(() => {});
        return { scene, imageOutput: null, error: err instanceof Error ? err.message : 'Unknown' };
      }
    },
  );

  // Upload and build scene map
  const sceneIllustrationMap = new Map<string, string | undefined>();
  const storedScenes: StoryScene[] = [];

  for (const { scene, imageOutput, error } of sceneResults) {
    if (!imageOutput) {
      this.logger.warn(`Scene image gen failed for story ${story.id}, scene ${scene.sceneId}: ${error ?? 'Unknown'}`);
      sceneIllustrationMap.set(scene.sceneId, undefined);
      storedScenes.push({
        sceneId: scene.sceneId,
        title: scene.title,
        illustrationUrl: null,
        illustrationBrief: scene.illustrationBrief,
        pageNumbers: scene.pages.map((p) => p.pageNumber),
      });
      continue;
    }

    let illustrationUrl: string | undefined;
    try {
      // Use the first page number as the file key for upload
      const fileKey = scene.pages[0]?.pageNumber ?? 1;
      illustrationUrl = imageOutput.imageBase64
        ? await this.uploadService.uploadGeneratedImage(story.userId, story.id, fileKey, imageOutput.imageBase64)
        : imageOutput.imageUrl || undefined;

      totalCostUsd += costPerImage;
      await this.aiUsageLogsRepo.save(
        this.aiUsageLogsRepo.create({
          userId: story.userId,
          storyId: story.id,
          universeId: story.universeId ?? null,
          provider: 'openai',
          model: imageModel,
          operation: AiOperation.ImageGeneration,
          imagesGenerated: 1,
          estimatedCostUsd: costPerImage,
          isSandbox,
        }),
      );
    } catch (uploadErr) {
      this.logger.warn(`Scene image upload failed for ${story.id}, scene ${scene.sceneId}: ${uploadErr instanceof Error ? uploadErr.message : 'Unknown'}`);
    }

    sceneIllustrationMap.set(scene.sceneId, illustrationUrl);
    storedScenes.push({
      sceneId: scene.sceneId,
      title: scene.title,
      illustrationUrl: illustrationUrl ?? null,
      illustrationBrief: scene.illustrationBrief,
      pageNumbers: scene.pages.map((p) => p.pageNumber),
    });
  }

  // Scenes beyond maxScenes get no illustration
  for (const scene of remainingScenes) {
    sceneIllustrationMap.set(scene.sceneId, undefined);
    storedScenes.push({
      sceneId: scene.sceneId,
      title: scene.title,
      illustrationUrl: null,
      illustrationBrief: scene.illustrationBrief,
      pageNumbers: scene.pages.map((p) => p.pageNumber),
    });
  }

  // Flatten scenes into StoryPage[], all pages in a scene share the same imageUrl
  const pages: StoryPage[] = scenes
    .flatMap((scene) =>
      scene.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        imageUrl: sceneIllustrationMap.get(scene.sceneId),
        audioUrl: undefined,
        sceneDescription: page.sceneDescription,
        dialogue: page.dialogue,
        characters: page.characters,
        camera: page.camera,
        cropHint: (page as any).cropHint,   // cast needed until interface is updated
        sceneId: scene.sceneId,
        background: page.background,
      }))
    )
    .sort((a, b) => a.pageNumber - b.pageNumber);

  return { pages, scenes: storedScenes, totalCostUsd };
}
```

**Note:** Import `SceneOutput` from the story generation provider interface at the top of the file. Also import `StoryScene` from the story entity.

---

## 6. Update Main Orchestration in `generateStory()`

In the main `generateStory()` method, replace the `generatePageImages` call with:

```typescript
// Phase 2: use scene-based generation if Gemini returned scenes
const useSceneGeneration = Array.isArray(normalizedGenerated.scenes) && normalizedGenerated.scenes.length > 0;

let pagesWithImages: StoryPage[];
let totalImageCostUsd: number;
let generatedScenes: StoryScene[] | null = null;

if (useSceneGeneration) {
  const sceneResult = await this.generateSceneImages(
    story, hero, heroName, heroAge, normalizedGenerated,
    supportingCharLabels, supportingCharAvatars, supportingCharDescriptions,
    isSandbox, storyVisualState,
    async (sceneNum, total) => {
      await updateJob({
        currentStep: `Generating Illustrations (scene ${sceneNum}/${total})`,
        progressPercentage: 20 + Math.round((60 * sceneNum) / total),
      });
    },
  );
  pagesWithImages = sceneResult.pages;
  totalImageCostUsd = sceneResult.totalCostUsd;
  generatedScenes = sceneResult.scenes;
  this.logger.log(`Story ${storyId}: scene-based generation — ${sceneResult.scenes.length} scenes, ${pagesWithImages.length} pages, ${totalImageCostUsd.toFixed(4)} USD`);
} else {
  // Phase 1 fallback: one image per page
  const pageResult = await this.generatePageImages(
    story, hero, heroName, heroAge, normalizedGenerated,
    supportingCharLabels, supportingCharAvatars, supportingCharDescriptions,
    isSandbox, storyVisualState,
    async (pageNum, total) => {
      await updateJob({
        currentStep: `Generating Illustrations (${pageNum}/${total})`,
        progressPercentage: 20 + Math.round((60 * pageNum) / total),
      });
    },
  );
  pagesWithImages = pageResult.pages;
  totalImageCostUsd = pageResult.totalCostUsd;
}
```

**Update the `storiesRepo.update()` save call** to include scenes:

```typescript
await this.storiesRepo.update(storyId, {
  status: StoryStatus.Completed,
  title: generated.title || `${heroName}'s Adventure`,
  pages,
  scenes: generatedScenes,   // NEW
  coverImageUrl: generatedScenes?.[0]?.illustrationUrl ?? pages[0]?.imageUrl ?? null,  // use scene 1 illustration as cover
  cliffhanger: generated.cliffhanger ?? null,
  arcId,
});
```

---

## 7. Add Platform Setting for Scene Mode

In `apps/api/src/admin/platform-setting.entity.ts`, add to `SETTING_DEFAULTS`:

```typescript
ENABLE_SCENE_GENERATION: { value: 'true', description: 'Use scene-based illustration grouping (Phase 2). Reduces AI image cost by 50-60%.' },
```

In `GenerationService.generateStory()`, check this setting before deciding scene vs page mode:

```typescript
const sceneGenerationEnabled = await this.getBooleanSetting('ENABLE_SCENE_GENERATION', true);
const useSceneGeneration = sceneGenerationEnabled && Array.isArray(normalizedGenerated.scenes) && normalizedGenerated.scenes.length > 0;
```

---

## 8. Update Admin Platform Settings Seed (Optional)

If there is a seed file or migration for platform settings, add:

```sql
INSERT INTO platform_settings (key, value) VALUES ('ENABLE_SCENE_GENERATION', 'true') ON CONFLICT (key) DO NOTHING;
```

If TypeORM auto-creates it via `synchronize: true`, the `SETTING_DEFAULTS` addition is sufficient.

---

## 9. Make `SceneOutput` importable in `generation.service.ts`

The service already imports from `story-generation.provider.ts`. Just add `SceneOutput` to the import:

```typescript
import type { ..., SceneOutput, StoryGenerationOutput, ... } from '../ai/interfaces/story-generation.provider';
```

Also import `StoryScene` from the story entity:

```typescript
import { Story, StoryMode, StoryPage, StoryScene, StoryStatus, StoryTheme, StoryVisualState } from '../stories/story.entity';
```

---

## 10. Update `ImageGenerationInput` — remove `dialogue` from scene-level calls

When calling `generateImageWithRetry` for scene illustrations, do NOT pass `dialogue` (since speech bubbles are a UI concern). The `dialogue` field on `ImageGenerationInput` can stay in the interface for per-page use cases, but scene generation should pass `dialogue: undefined`.

---

## Summary of Changes

| File | Change Type | Description |
|---|---|---|
| `story.entity.ts` | Add fields | `StoryScene` interface, `Story.scenes` JSONB, `StoryPage.sceneId`, `StoryPage.cropHint` |
| `story-generation.provider.ts` | Add interface | `SceneOutput`, `StoryGenerationOutput.scenes` |
| `gemini-story.provider.ts` | Update prompt | Output `scenes[]` instead of flat `pages[]`, add `illustrationBrief`, `cropHint` |
| `generation.service.ts` | New method | `generateSceneImages()` |
| `generation.service.ts` | Update method | `normalizeGeneratedStory()` handles scenes |
| `generation.service.ts` | Update orchestration | Choose scene vs page generation based on Gemini output |
| `platform-setting.entity.ts` | Add setting | `ENABLE_SCENE_GENERATION` |

---

## Acceptance Criteria

- `Story.scenes` is non-null after generation of a new story
- 8-page story generates 3 scene illustrations instead of 8 page illustrations (≈63% cost reduction)
- All 8 pages in `story.pages` have valid `imageUrl` (pointing to shared scene illustrations)
- Pages within same scene have the same `imageUrl` but different `cropHint`
- First scene's `illustrationUrl` is used as `coverImageUrl`
- Per-page fallback still works when `scenes` is absent from Gemini output
- `ENABLE_SCENE_GENERATION: false` disables scene mode and falls back to Phase 1
- TypeScript compiles without errors
- Phase 1 `storyVisualState`, `characterIdentity`, `heroAvatarDescription` identity system unchanged

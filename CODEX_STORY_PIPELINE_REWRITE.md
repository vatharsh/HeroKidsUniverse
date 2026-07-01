# HeroKids Universe — Story Pipeline Rewrite (Backend)

## Objective

Redesign the story generation pipeline for visual consistency. Characters must be instantly recognisable in every panel. Costume, companion, weapon, and powers must stay locked within a story. Every page must carry structured dialogue, character expressions, poses, camera direction, and background — so the image model has zero creative freedom over character identity.

**Do NOT change avatar generation. Everything after avatar creation needs improvement.**

TypeORM has `synchronize: true` — new columns/entities auto-migrate. No manual SQL needed.

---

## 1. New TypeScript Interfaces

### `apps/api/src/stories/story.entity.ts`

**Replace** the existing `StoryPage` interface with:

```typescript
export interface PageDialogue {
  speaker: string;
  text: string;
  emotion?: string;
}

export interface PageCharacter {
  name: string;
  expression?: string;
  pose?: string;
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  sceneDescription?: string;
  dialogue?: PageDialogue[];
  characters?: PageCharacter[];
  camera?: string;
  background?: string;
}
```

**Add** a new `StoryVisualState` interface (place before `@Entity`):

```typescript
export interface StoryVisualState {
  costume: string | null;
  companion: string | null;
  weapon: string | null;
  powers: string[];
  inventory: string[];
  transformation: string | null;
}
```

**Add** a new column to the `Story` entity class:

```typescript
@Column({ type: 'jsonb', nullable: true })
storyVisualState!: StoryVisualState | null;
```

---

### `apps/api/src/universes/universe.entity.ts`

**Add** interface and column:

```typescript
export interface UniverseVisualState {
  costume: string | null;
  colorPalette: string | null;
  companion: string | null;
  weapon: string | null;
  vehicle: string | null;
  heroPowerVisual: string | null;
  badgeStyle: string | null;
}
```

Add to the `Universe` entity class:

```typescript
@Column({ type: 'jsonb', nullable: true })
visualState!: UniverseVisualState | null;
```

---

### `apps/api/src/heroes/hero.entity.ts`

**Add** interface and column:

```typescript
export interface CharacterIdentity {
  faceShape: string | null;
  skinTone: string | null;
  eyeShape: string | null;
  eyeColor: string | null;
  hairstyle: string | null;
  hairColor: string | null;
  hairLength: string | null;
  distinctiveFeatures: string[];
  neverChangeRules: string[];
}
```

Add to the `Hero` entity class:

```typescript
@Column({ type: 'jsonb', nullable: true })
characterIdentity!: CharacterIdentity | null;
```

---

## 2. Update Story Generation Interface

### `apps/api/src/ai/interfaces/story-generation.provider.ts`

**Replace** the pages type in `StoryGenerationOutput`:

```typescript
export interface PageDialogue {
  speaker: string;
  text: string;
  emotion?: string;
}

export interface PageCharacter {
  name: string;
  expression?: string;
  pose?: string;
}

export interface StoryVisualStateOutput {
  costume: string | null;
  companion: string | null;
  weapon: string | null;
  powers: string[];
  inventory: string[];
}

export interface StoryGenerationOutput {
  title: string;
  cliffhanger?: string;
  storyVisualState?: StoryVisualStateOutput;  // NEW: Gemini suggests the visual state for this story
  newPowers?: string[];
  newQuests?: string[];
  newMemories?: Array<{ type: string; title: string; detail?: string }>;
  pages: Array<{
    pageNumber: number;
    text: string;
    sceneDescription: string;
    dialogue?: PageDialogue[];
    characters?: PageCharacter[];
    camera?: string;
    background?: string;
  }>;
  provider?: string;
  model?: string;
  prompt?: string;
  rawResponse?: string;
  inputTokens?: number;
  outputTokens?: number;
}
```

**Add** to `StoryGenerationInput`:

```typescript
storyVisualState?: {
  costume: string | null;
  companion: string | null;
  weapon: string | null;
  powers: string[];
  inventory: string[];
} | null;
```

---

## 3. Update Gemini Story Provider

### `apps/api/src/ai/providers/gemini-story.provider.ts`

**In `buildPrompt`**, add a `storyVisualState` section when it's provided via `input.storyVisualState`:

```typescript
const visualStateSection = input.storyVisualState
  ? `
STORY VISUAL STATE (LOCKED — these must appear consistently throughout every page):
Costume: ${input.storyVisualState.costume ?? 'Regular clothes'}
Companion: ${input.storyVisualState.companion ?? 'None'}
Weapon/Item: ${input.storyVisualState.weapon ?? 'None'}
Active Powers: ${input.storyVisualState.powers.join(', ') || 'None'}
Inventory: ${input.storyVisualState.inventory.join(', ') || 'None'}

Every scene description and character reference MUST include these visual elements unless the story explicitly changes them.
`
  : '';
```

Insert this section before the `Rules:` block.

**Update the JSON output schema** in the prompt. Replace the current page schema with:

```
{
  "title": "...",
  "cliffhanger": "...",
  "storyVisualState": {
    "costume": "Describe the hero's full costume for this story",
    "companion": "Companion name and type, or null",
    "weapon": "Primary weapon or item, or null",
    "powers": ["Power 1", "Power 2"],
    "inventory": ["Item 1", "Item 2"]
  },
  "newPowers": [],
  "newQuests": [],
  "newMemories": [],
  "pages": [
    {
      "pageNumber": 1,
      "text": "...",
      "sceneDescription": "Full scene with EVERY character's appearance described from canonical identity",
      "background": "One sentence describing the setting and lighting",
      "camera": "Camera angle — e.g. wide angle, close-up, low angle",
      "characters": [
        { "name": "HeroName", "expression": "excited", "pose": "pointing upward with right arm" }
      ],
      "dialogue": [
        { "speaker": "HeroName", "text": "The actual spoken line", "emotion": "excited" }
      ]
    }
  ]
}
```

Rules for the new fields:
- `background`: one sentence, specific location + time of day + lighting mood  
- `camera`: choose from: wide angle, medium shot, close-up on face, low angle looking up, bird's eye view, over-the-shoulder
- `characters`: EVERY named character visible in the scene must appear with expression + pose
- `dialogue`: only lines that are spoken aloud (not thoughts); omit if no one speaks; max 2 dialogues per page
- `storyVisualState`: for universe stories this reflects the hero's current look; for standalone stories Gemini should design it to match the theme

**Add to the Rules section of the prompt:**
```
- In every sceneDescription: explicitly name the costume, companion, and weapon from the Story Visual State — do not leave them out
- In characters: always describe the expression and pose for the main hero on every page
- Speech bubbles: only add dialogue if it adds to the scene; avoid generic exclamations
```

---

## 4. Update Image Generation Interface

### `apps/api/src/ai/interfaces/image-generation.provider.ts`

**Add** to `ImageGenerationInput`:

```typescript
storyVisualState?: {
  costume: string | null;
  companion: string | null;
  weapon: string | null;
  powers: string[];
  inventory: string[];
} | null;
dialogue?: Array<{ speaker: string; text: string; emotion?: string }>;
characters?: Array<{ name: string; expression?: string; pose?: string }>;
camera?: string;
```

---

## 5. Update OpenAI Image Provider

### `apps/api/src/ai/providers/openai-image.provider.ts`

**In `generateImage`**, build two new prompt sections from the new input fields and insert them after `heroIdentityLine`:

```typescript
// Story Visual State lock — after heroIdentityLine
const storyStateLockLine = input.storyVisualState
  ? [
      'STORY VISUAL STATE (LOCKED for this entire story — draw EXACTLY as specified, do not deviate):',
      `Costume: ${input.storyVisualState.costume ?? 'Regular casual clothes'}`,
      input.storyVisualState.companion
        ? `Companion: ${input.storyVisualState.companion} — always visible nearby, consistent appearance across all pages`
        : '',
      input.storyVisualState.weapon
        ? `Weapon/Item: ${input.storyVisualState.weapon} — in hero's hand or clearly at their side`
        : '',
      input.storyVisualState.powers.length
        ? `Active Powers: ${input.storyVisualState.powers.join(', ')} — show visual effect (glow, aura, spark)`
        : '',
      input.storyVisualState.inventory.length
        ? `Inventory visible: ${input.storyVisualState.inventory.join(', ')}`
        : '',
      'The costume and companion are COSTUME LOCKED — same colour, same design, same silhouette on every page.',
    ].filter(Boolean).join('\n')
  : '';

// Expressions and poses from Gemini
const characterDirectionLine = input.characters?.length
  ? [
      'CHARACTER DIRECTION FOR THIS SCENE:',
      ...input.characters.map(
        (c) => `${c.name}: ${c.expression ? `expression — ${c.expression}` : ''}${c.pose ? `, pose — ${c.pose}` : ''}`,
      ),
    ].join('\n')
  : '';

// Camera direction
const cameraLine = input.camera
  ? `CAMERA: ${input.camera}`
  : '';

// Dialogue / speech bubbles
const dialogueLine = input.dialogue?.length
  ? [
      'DIALOGUE BUBBLES — render speech bubbles with this exact text, positioned near the speaker:',
      ...input.dialogue.map((d) => `${d.speaker}: "${d.text}"`),
      'Use clean comic-book style speech bubbles. The speaking character\'s mouth must be open. Non-speaking characters react with appropriate expression.',
    ].join('\n')
  : '';
```

**Update the prompt array** to include these new sections in order:

```typescript
const prompt = [
  input.style ?? 'vibrant full-color children\'s storybook illustration, warm Pixar-style cartoon art, expressive characters, rich colorful backgrounds',
  referenceOrderLine,
  heroIdentityLine,
  storyStateLockLine,      // NEW
  castLine,
  characterDirectionLine,  // NEW
  cameraLine,              // NEW
  input.sceneDescription,
  dialogueLine,            // NEW
  'If the scene description conflicts with the reference portraits or identity descriptions, ignore the conflicting visual detail and follow the identity descriptions/reference portraits.',
  'IDENTITY LOCK: do not turn people into generic cartoon archetypes. Do not add glasses, bindis, moustaches, jewellery, white hair, facial hair, or age changes unless the identity description or reference image has them.',
  'CAST LOCK: draw only the named characters required by the scene. Do not duplicate a child face for another child. Each named person must remain visually distinct and consistent across pages.',
  'Child-safe, joyful and adventurous atmosphere, no text or watermarks in the image.',
].filter(Boolean).join('\n');
```

---

## 6. Update Generation Service

### `apps/api/src/generation/generation.service.ts`

**Step A — Build Story Visual State after story text generation.**

After the `this.storyProvider.generateStory(...)` call resolves (after the `generated` variable is set), add:

```typescript
// Build storyVisualState: prefer Gemini's suggestion; fall back to universe context
let storyVisualState: import('../stories/story.entity').StoryVisualState | null = null;

if (generated.storyVisualState) {
  storyVisualState = {
    costume: generated.storyVisualState.costume,
    companion: generated.storyVisualState.companion,
    weapon: generated.storyVisualState.weapon,
    powers: generated.storyVisualState.powers ?? [],
    inventory: generated.storyVisualState.inventory ?? [],
    transformation: null,
  };
} else if (universeContext) {
  // Derive from universe context: companion + powers
  storyVisualState = {
    costume: null,
    companion: universeContext.companion ? `${universeContext.companion.name} (${universeContext.companion.type})` : null,
    weapon: null,
    powers: universeContext.heroPowers ?? [],
    inventory: universeContext.heroPowers ?? [],
    transformation: null,
  };
}

// Persist storyVisualState on the story entity immediately
if (storyVisualState) {
  await this.storiesRepo.update(storyId, { storyVisualState });
}
```

**Step B — Pass storyVisualState to Gemini.**

In the `this.storyProvider.generateStory({...})` call, add:

```typescript
storyVisualState: null, // Gemini will suggest it; no pre-existing state needed for first call
```

For universe `continue_arc` / `new_arc` stories where there IS an existing visual state from a previous story, load it and pass it in. Add this before the `generateStory` call:

```typescript
// Load previous story's visual state for universe continuity
let existingVisualState: import('../stories/story.entity').StoryVisualState | null = null;
if (story.universeId && story.storyMode !== 'new_adventure') {
  const prevStory = await this.storiesRepo.findOne({
    where: { universeId: story.universeId, status: StoryStatus.Completed },
    order: { createdAt: 'DESC' },
  });
  existingVisualState = prevStory?.storyVisualState ?? null;
}
```

Pass `storyVisualState: existingVisualState` to `generateStory`.

**Step C — Update `generatePageImages` signature and call.**

Add `storyVisualState: import('../stories/story.entity').StoryVisualState | null` as the last parameter to `generatePageImages`.

**Step D — Pass per-page data to `generateImageWithRetry`.**

Inside `generatePageImages`, in the `mapWithConcurrency` callback, update the `generateImageWithRetry` call:

```typescript
const imageOutput = await this.generateImageWithRetry({
  sceneDescription: page.sceneDescription,
  heroName,
  heroAge,
  supportingCharacters,
  heroAvatarUrl: hero.avatarUrl ?? undefined,
  heroAvatarDescription: hero.avatarDescription ?? undefined,
  characterAvatarUrls,
  characterAvatarDescriptions,
  style: 'premium full-color children\'s storybook illustration, warm semi-realistic cartoon art, expressive but recognisable faces, rich colorful backgrounds, Indian family storybook warmth',
  storyVisualState: storyVisualState ?? undefined,   // NEW
  dialogue: page.dialogue,                           // NEW
  characters: page.characters,                       // NEW
  camera: page.camera,                               // NEW
});
```

**Step E — Preserve rich page data in stored `StoryPage`.**

When pushing to the `pages` array in `generatePageImages`, store the new fields:

```typescript
pages.push({
  pageNumber: page.pageNumber,
  text: page.text,
  imageUrl,
  audioUrl: undefined,
  sceneDescription: page.sceneDescription,  // NEW
  dialogue: page.dialogue,                   // NEW
  characters: page.characters,               // NEW
  camera: page.camera,                       // NEW
  background: page.background,               // NEW
});
```

Also update the `remainingPages` loop:

```typescript
pages.push({
  pageNumber: page.pageNumber,
  text: page.text,
  imageUrl: undefined,
  audioUrl: undefined,
  sceneDescription: page.sceneDescription,
  dialogue: page.dialogue,
  characters: page.characters,
  camera: page.camera,
  background: page.background,
});
```

---

## 7. Character Identity Extraction (Post Avatar)

### `apps/api/src/avatars/avatars.service.ts`

After the `avatarUrl` is persisted and before returning, extract a structured character identity from the `avatarDescription` if one exists. If the hero has a description (from `describeCharacterAppearance`), parse it into structured `CharacterIdentity` by calling GPT-4o-mini.

First, inject `HeroesService` or `Repository<Hero>` and `Repository<Character>` into `AvatarsService`. Then add a private method:

```typescript
private async extractCharacterIdentity(description: string): Promise<import('../heroes/hero.entity').CharacterIdentity | null> {
  try {
    const response = await this.imageProvider.extractStructuredIdentity(description);
    return response;
  } catch {
    return null;
  }
}
```

### `apps/api/src/ai/interfaces/image-generation.provider.ts`

Add to the `ImageGenerationProvider` interface:

```typescript
extractStructuredIdentity(description: string): Promise<import('../../heroes/hero.entity').CharacterIdentity | null>;
```

### `apps/api/src/ai/providers/openai-image.provider.ts`

Add the `extractStructuredIdentity` method:

```typescript
async extractStructuredIdentity(description: string): Promise<import('../../heroes/hero.entity').CharacterIdentity | null> {
  try {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `Extract structured visual identity from this appearance description. Return ONLY valid JSON matching this exact schema:
{
  "faceShape": "oval/round/square/heart/etc or null",
  "skinTone": "specific description",
  "eyeShape": "almond/round/etc",
  "eyeColor": "colour",
  "hairstyle": "specific description",
  "hairColor": "specific colour",
  "hairLength": "short/medium/long/bald",
  "distinctiveFeatures": ["glasses", "dimples", etc — list only features visibly present],
  "neverChangeRules": [
    "Never change hairstyle",
    "Never change skin tone",
    "Never add glasses",
    "Never add beard or moustache",
    "Never change age",
    "Never change face shape"
  ]
}

Description to parse:
"${description}"`,
      }],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as import('../../heroes/hero.entity').CharacterIdentity;
  } catch {
    return null;
  }
}
```

---

## 8. Expose Universe Visual State via API

### `apps/api/src/universes/universes.controller.ts`

Add a `PATCH /universes/:id/visual-state` endpoint so the admin (or future UI) can set/update the universe visual state:

```typescript
@Patch(':id/visual-state')
async updateVisualState(
  @Param('id') id: string,
  @CurrentUser() user: CurrentUserPayload,
  @Body() body: Partial<UniverseVisualState>,
) {
  return this.universesService.updateVisualState(id, user.id, body);
}
```

### `apps/api/src/universes/universes.service.ts`

Add:

```typescript
async updateVisualState(universeId: string, userId: string, patch: Partial<UniverseVisualState>) {
  const universe = await this.universesRepo.findOneOrFail({ where: { id: universeId, userId } });
  universe.visualState = { ...universe.visualState, ...patch } as UniverseVisualState;
  return this.universesRepo.save(universe);
}
```

---

## 9. Update Universe Context Builder

### `apps/api/src/generation/generation.service.ts` — `buildUniverseContext` private method

After building the context, also fetch and attach the universe's visual state:

Find where `universeContext` is built and make sure the companion, powers, and any visualState from the `Universe` entity are reflected so Gemini gets a complete picture.

If `universe.visualState` exists, pass it as additional flavor into `storyGenerationInput.storyVisualState` for `continue_arc` stories.

---

## Summary of New Fields

| Entity/Type | New Field | Type |
|---|---|---|
| `Story` | `storyVisualState` | `jsonb / StoryVisualState \| null` |
| `Universe` | `visualState` | `jsonb / UniverseVisualState \| null` |
| `Hero` | `characterIdentity` | `jsonb / CharacterIdentity \| null` |
| `StoryPage` | `sceneDescription`, `dialogue`, `characters`, `camera`, `background` | optional fields |
| `StoryGenerationOutput` | `storyVisualState`, richer page objects | added |
| `StoryGenerationInput` | `storyVisualState` | added |
| `ImageGenerationInput` | `storyVisualState`, `dialogue`, `characters`, `camera` | added |

---

## Acceptance Criteria

- `Story.storyVisualState` is saved after story generation and non-null for new stories
- Every `StoryPage` in `story.pages` includes `sceneDescription`, `dialogue`, `characters`, `camera`, `background` fields
- OpenAI image prompt includes STORY VISUAL STATE LOCK block and DIALOGUE BUBBLES block
- Gemini outputs `storyVisualState` in its JSON response
- `Hero.characterIdentity` is populated after avatar generation
- All TypeScript compiles without errors
- No existing tests broken

# Codex Prompt — Milestone 2: Speech Bubble Engine + Character Direction + Story State

## Context

This is HeroKids Universe — an AI-powered personalized children's storybook platform. Tech: NestJS + TypeORM + PostgreSQL backend at `apps/api/`, Next.js frontend at `apps/web/`.

**What already exists (do not break):**
- Character Canon system (`apps/api/src/characters/character-canon.service.ts`, `character-canon.entity.ts`, `character-canon.module.ts`)
- Scene-based generation with `generateSceneImages` in `generation.service.ts`
- `StoryPage`, `StoryVisualState`, `StoryScene` interfaces in `story.entity.ts`
- Gemini story generation in `gemini-story.provider.ts`
- OpenAI image generation with canon + face QA in `openai-image.provider.ts`

**Goal of this milestone:** Richer structured story output so illustrations are directed precisely, speech bubbles carry semantic metadata, and story state (costumes, items, powers) persists reliably across pages.

---

## Step 1 — Update `story-generation.provider.ts` Interfaces

File: `apps/api/src/ai/interfaces/story-generation.provider.ts`

**Add these new interfaces** (append before the existing `StoryGenerationInput`):

```typescript
export type SpeechBubbleStyle = 'normal' | 'excited' | 'whisper' | 'thinking' | 'surprised';

export interface ExpressionDetails {
  eyes?: string;      // e.g. "wide and focused"
  mouth?: string;     // e.g. "slightly open, mid-sentence"
  eyebrows?: string;  // e.g. "raised in surprise"
}

export interface PageCharacterDirection {
  characterId?: string;          // optional — may not match DB ID
  name: string;
  role?: string;                 // 'hero' | 'supporting' | 'companion' | 'villain'
  expression: string;            // concrete: "wide eyes, excited grin, eyebrows raised"
  expressionDetails?: ExpressionDetails;
  pose: string;                  // e.g. "holding glowing compass with both hands"
  facingDirection?: string;      // e.g. "three-quarter front"
  gazeDirection?: string;        // e.g. "looking at cave wall"
  isSpeaking?: boolean;
  reactionToScene?: string;      // e.g. "backing away in surprise"
  requiredVisibleFeatures?: string[]; // e.g. ["glowing shield", "red cape"]
}

export interface SpeechBubbleMetadata {
  speakerName: string;
  text: string;
  emotion?: string;
  bubbleStyle: SpeechBubbleStyle;
  placementHint?: string;        // e.g. "upper left near Siddhant"
  priority?: number;             // 1 = primary, 2 = secondary
}

export interface PageStoryStateUpdate {
  newItems?: string[];
  removedItems?: string[];
  newPowers?: string[];
  removedPowers?: string[];
  newCompanions?: string[];
  removedCompanions?: string[];
  locationChange?: string;
  costumeChange?: string;        // only if story explicitly changes costume
}
```

**Update the existing `PageDialogue` interface** — add new optional fields:

```typescript
export interface PageDialogue {
  speaker: string;
  text: string;
  emotion?: string;
  bubbleStyle?: SpeechBubbleStyle;
  placementHint?: string;
}
```

**Update the existing `PageCharacter` interface** — add new optional fields:

```typescript
export interface PageCharacter {
  name: string;
  expression?: string;
  pose?: string;
  expressionDetails?: ExpressionDetails;
  facingDirection?: string;
  gazeDirection?: string;
  isSpeaking?: boolean;
  reactionToScene?: string;
}
```

**Update `SceneOutput.pages` array** — add new fields to each page object (keep all existing fields):

```typescript
// In the pages array inside SceneOutput, add:
characterDirections?: PageCharacterDirection[];
speechBubbles?: SpeechBubbleMetadata[];
storyStateUpdate?: PageStoryStateUpdate;
```

**Update `StoryGenerationOutput`** — add `storyStateTracking` field to the pages array:

In the `pages` array of `StoryGenerationOutput`, add the same new fields:
```typescript
characterDirections?: PageCharacterDirection[];
speechBubbles?: SpeechBubbleMetadata[];
storyStateUpdate?: PageStoryStateUpdate;
```

---

## Step 2 — Update `story.entity.ts` Interfaces

File: `apps/api/src/stories/story.entity.ts`

**Update `PageDialogue`** — add `bubbleStyle` and `placementHint`:

```typescript
export interface PageDialogue {
  speaker: string;
  text: string;
  emotion?: string;
  bubbleStyle?: string;  // 'normal' | 'excited' | 'whisper' | 'thinking' | 'surprised'
  placementHint?: string;
}
```

**Update `PageCharacter`** — add new direction fields:

```typescript
export interface PageCharacter {
  name: string;
  expression?: string;
  pose?: string;
  expressionDetails?: { eyes?: string; mouth?: string; eyebrows?: string };
  facingDirection?: string;
  gazeDirection?: string;
  isSpeaking?: boolean;
  reactionToScene?: string;
}
```

**Update `StoryPage`** — add new structured fields (all optional for backward compat):

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
  cropHint?: string;
  sceneId?: string;
  background?: string;
  // NEW in Milestone 2:
  speechBubbles?: Array<{
    speakerName: string;
    text: string;
    emotion?: string;
    bubbleStyle?: string;
    placementHint?: string;
    priority?: number;
  }>;
  storyStateSnapshot?: {
    location?: string;
    costume?: string;
    items?: string[];
    powers?: string[];
    companions?: string[];
  };
  imagePromptUsed?: string;  // for debug view
}
```

Also update the `StoryVisualState` interface — add a `currentLocation` field:

```typescript
export interface StoryVisualState {
  costume: string | null;
  companion: string | null;
  weapon: string | null;
  powers: string[];
  inventory: string[];
  transformation: string | null;
  currentLocation?: string;   // NEW — tracks where in the story we are
}
```

---

## Step 3 — Update Gemini Prompt in `gemini-story.provider.ts`

File: `apps/api/src/ai/providers/gemini-story.provider.ts`

**Goal**: Make Gemini output rich structured character direction and speech bubble metadata for every page.

### 3a — Update `pageEntriesPerScene` template

Replace the current `pageEntriesPerScene` function body with:

```typescript
const pageEntriesPerScene = (pagesInScene: number[]) =>
  pagesInScene.map((pageNum) =>
    `      {
        "pageNumber": ${pageNum},
        "text": "Narration text for this page (2-3 sentences, max 40 words)",
        "sceneDescription": "Full scene with EVERY character's appearance, costume, and action described",
        "background": "One sentence: location, time of day, lighting mood",
        "camera": "wide angle|medium shot|close-up on face|low angle looking up|bird's eye view",
        "cropHint": "${pageNum === pagesInScene[0] ? 'full_width' : 'zoom_hero'}",
        "characterDirections": [
          {
            "name": "${heroRef}",
            "role": "hero",
            "expression": "concrete expression description e.g. wide eyes, excited grin, eyebrows raised",
            "expressionDetails": { "eyes": "...", "mouth": "...", "eyebrows": "..." },
            "pose": "exact pose e.g. holding glowing compass with both hands",
            "facingDirection": "three-quarter front",
            "gazeDirection": "looking at the cave wall",
            "isSpeaking": false,
            "reactionToScene": "backing away in surprise"
          }
        ],
        "speechBubbles": [],
        "storyStateUpdate": {
          "newItems": [],
          "removedItems": [],
          "newPowers": [],
          "removedPowers": [],
          "locationChange": null,
          "costumeChange": null
        },
        "dialogue": []
      }`,
  ).join(',\n');
```

### 3b — Add character direction rules to the main prompt text

In the `return` block of `buildPrompt`, after the existing `SCENE GROUPING RULES` section, add a new section:

```
CHARACTER DIRECTION RULES:
- Every named character visible in a scene MUST appear in characterDirections.
- expression must be CONCRETE: not "happy" but "wide grin, sparkling eyes, eyebrows raised in delight".
- Not "surprised" but "eyes wide open, mouth in an O shape, eyebrows high on forehead".
- isSpeaking must be true for exactly one character per speechBubble entry.
- If a character is speaking: mouth should be "slightly open, mid-sentence" in expressionDetails.
- If a character is not speaking but reacting: set reactionToScene to their reaction.

SPEECH BUBBLE RULES:
- speechBubbles array replaces the old dialogue array for structured dialogue.
- Also populate the dialogue array (legacy) with the same lines for backward compatibility.
- bubbleStyle options: "normal" | "excited" | "whisper" | "thinking" | "surprised"
- Use "excited" when the character is shouting, cheering, or very enthusiastic.
- Use "whisper" when the character speaks quietly or secretly.
- Use "thinking" for internal monologue (text starts with "I wonder..." or "Maybe...").
- Use "surprised" when the character is shocked or startled.
- Use "normal" for all other dialogue.
- placementHint: describe position relative to speaker e.g. "upper left near Siddhant", "top right near Vedant".
- Max 2 speechBubbles per page.
- Do NOT include text inside sceneDescription or illustrationBrief — bubbles are rendered by the frontend.

STORY STATE UPDATE RULES:
- storyStateUpdate must be present on every page, even if all arrays are empty.
- Only set newItems/removedItems if the story explicitly gives or takes an item.
- Only set costumeChange if the story explicitly changes the hero's outfit.
- locationChange: set if the scene moves to a new place.
- Powers persist unless explicitly lost.
- Items persist unless explicitly lost or used up.
```

### 3c — Update JSON schema in prompt

In the `sceneEntries` template, update the pages structure to include the new fields:

The `pages` array inside each scene entry should show the updated structure with `characterDirections`, `speechBubbles`, and `storyStateUpdate` fields — matching the template in Step 3a above.

Also update the bottom `IMPORTANT:` section to add:

```
characterDirections: required for every page; at minimum include the hero with expression and pose.
speechBubbles: structured dialogue metadata; also echo in dialogue array for backward compat.
storyStateUpdate: required on every page; use empty arrays when nothing changes.
```

---

## Step 4 — Add Story State Engine to `generation.service.ts`

File: `apps/api/src/generation/generation.service.ts`

**Add a new private class** `StoryStateTracker` inside the same file (before the `@Injectable()` class):

```typescript
class StoryStateTracker {
  location: string | null;
  costume: string | null;
  items: Set<string>;
  powers: Set<string>;
  companions: Set<string>;
  weapon: string | null;

  constructor(initialState: StoryVisualState | null) {
    this.location = null;
    this.costume = initialState?.costume ?? null;
    this.items = new Set(initialState?.inventory ?? []);
    this.powers = new Set(initialState?.powers ?? []);
    this.companions = initialState?.companion ? new Set([initialState.companion]) : new Set();
    this.weapon = initialState?.weapon ?? null;
  }

  applyUpdate(update: {
    newItems?: string[];
    removedItems?: string[];
    newPowers?: string[];
    removedPowers?: string[];
    newCompanions?: string[];
    removedCompanions?: string[];
    locationChange?: string | null;
    costumeChange?: string | null;
  } | undefined): void {
    if (!update) return;
    update.newItems?.forEach((i) => this.items.add(i));
    update.removedItems?.forEach((i) => this.items.delete(i));
    update.newPowers?.forEach((p) => this.powers.add(p));
    update.removedPowers?.forEach((p) => this.powers.delete(p));
    update.newCompanions?.forEach((c) => this.companions.add(c));
    update.removedCompanions?.forEach((c) => this.companions.delete(c));
    if (update.locationChange) this.location = update.locationChange;
    if (update.costumeChange) this.costume = update.costumeChange;
  }

  toStateSnapshot(): { location?: string; costume?: string; items: string[]; powers: string[]; companions: string[] } {
    return {
      ...(this.location ? { location: this.location } : {}),
      ...(this.costume ? { costume: this.costume } : {}),
      items: Array.from(this.items),
      powers: Array.from(this.powers),
      companions: Array.from(this.companions),
    };
  }

  toImageStateBlock(): string {
    const lines: string[] = ['CURRENT STORY STATE (DO NOT CHANGE unless scene explicitly changes it):'];
    if (this.costume) lines.push(`Hero costume: ${this.costume}`);
    if (this.weapon) lines.push(`Hero weapon/item: ${this.weapon}`);
    if (this.items.size) lines.push(`Hero carries: ${Array.from(this.items).join(', ')}`);
    if (this.powers.size) lines.push(`Active powers (show visual effect): ${Array.from(this.powers).join(', ')}`);
    if (this.companions.size) lines.push(`Companions visible: ${Array.from(this.companions).join(', ')}`);
    if (this.location) lines.push(`Current location: ${this.location}`);
    return lines.join('\n');
  }
}
```

### 4a — Wire Story State into page-level image generation

In `generatePageImages`, before the `mapWithConcurrency` call, instantiate the tracker:

```typescript
const stateTracker = new StoryStateTracker(storyVisualState);
```

Then, **after** the concurrent generation loop completes and **before** the upload loop, apply state updates in page order:

Actually, since generation is concurrent, state tracking should happen **after** images are uploaded, in page order. Modify the upload loop:

After building each `pages.push({...})` entry, call:
```typescript
// Apply state update for this page (in page order)
const pageData = generated.pages.find(p => p.pageNumber === page.pageNumber);
stateTracker.applyUpdate((pageData as any)?.storyStateUpdate);
```

But the correct approach is to pre-compute the snapshot **before** generating each page's image. Since generation is concurrent, do this:

1. Pre-compute state snapshots sequentially before launching concurrent generation
2. Pass snapshot into each `ImageGenerationInput` as `storyStateSnapshot`

Add a new field to `ImageGenerationInput`:

```typescript
storyStateSnapshot?: {
  location?: string;
  costume?: string;
  items?: string[];
  powers?: string[];
  companions?: string[];
};
```

And add a `storyStateBlock?: string` field too (precomputed string for the prompt).

Then in the prep loop before `mapWithConcurrency`:

```typescript
const stateTracker = new StoryStateTracker(storyVisualState);
const pageStateBlocks = new Map<number, string>();
for (const page of generated.pages) {
  pageStateBlocks.set(page.pageNumber, stateTracker.toImageStateBlock());
  stateTracker.applyUpdate((page as any).storyStateUpdate);
}
```

Then in the `imageInput` construction inside `mapWithConcurrency`:
```typescript
storyStateBlock: pageStateBlocks.get(page.pageNumber),
```

And in the page push after upload, add `storyStateSnapshot`:
```typescript
storyStateSnapshot: stateTracker.toStateSnapshot(), // not quite right — we need the snapshot AT that page
```

Actually, to keep it simple: pre-compute snapshots before concurrent generation:

```typescript
const stateTracker = new StoryStateTracker(storyVisualState);
const pageSnapshotMap = new Map<number, string>();
for (const p of illustratedPages) {
  pageSnapshotMap.set(p.pageNumber, stateTracker.toImageStateBlock());
  stateTracker.applyUpdate((p as any).storyStateUpdate);
}
// Then in imageInput construction:
storyStateBlock: pageSnapshotMap.get(page.pageNumber) ?? undefined,
```

Do the same in `generateSceneImages` — compute scene-level snapshots before concurrent scene generation.

### 4b — Also store storyStateSnapshot on saved pages

When pushing to `pages` array in upload loop, include the pre-computed snapshot:

```typescript
pages.push({
  ...existingFields,
  speechBubbles: (page as any).speechBubbles,
  storyStateSnapshot: precomputedSnapshot,  // the state AT this page
});
```

---

## Step 5 — Update `image-generation.provider.ts`

File: `apps/api/src/ai/interfaces/image-generation.provider.ts`

Add to `ImageGenerationInput`:

```typescript
storyStateBlock?: string;   // pre-built state summary for the image prompt
characterDirections?: Array<{
  name: string;
  expression: string;
  expressionDetails?: { eyes?: string; mouth?: string; eyebrows?: string };
  pose: string;
  facingDirection?: string;
  isSpeaking?: boolean;
  reactionToScene?: string;
}>;
```

---

## Step 6 — Update `openai-image.provider.ts`

File: `apps/api/src/ai/providers/openai-image.provider.ts`

### 6a — Replace `characterDirectionLine` with rich version

Replace the existing `characterDirectionLine` block with:

```typescript
const characterDirectionLine = (input.characterDirections?.length ?? 0) > 0
  ? [
      'CHARACTER DIRECTIONS — render each character exactly as specified:',
      ...(input.characterDirections ?? []).map((c) => {
        const parts = [`${c.name}: expression — ${c.expression}`];
        if (c.expressionDetails?.eyes)     parts.push(`eyes: ${c.expressionDetails.eyes}`);
        if (c.expressionDetails?.mouth)    parts.push(`mouth: ${c.expressionDetails.mouth}`);
        if (c.expressionDetails?.eyebrows) parts.push(`eyebrows: ${c.expressionDetails.eyebrows}`);
        if (c.pose)              parts.push(`pose: ${c.pose}`);
        if (c.facingDirection)   parts.push(`facing: ${c.facingDirection}`);
        if (c.isSpeaking)        parts.push('mouth: open, mid-speech');
        if (c.reactionToScene)   parts.push(`reaction: ${c.reactionToScene}`);
        return parts.join('; ');
      }),
    ].join('\n')
  : input.characters?.length
    ? [
        'CHARACTER DIRECTION FOR THIS SCENE:',
        ...input.characters.map(
          (c) => `${c.name}: ${c.expression ? `expression — ${c.expression}` : ''}${c.pose ? `${c.expression ? ', ' : ''}pose — ${c.pose}` : ''}`,
        ),
      ].join('\n')
    : '';
```

### 6b — Use `storyStateBlock` in prompt if available

Replace the existing `storyStateLockLine` usage in the prompt array with:

```typescript
input.storyStateBlock ?? storyStateLockLine,
```

This means if `storyStateBlock` is set (new Story State Engine output), use that; otherwise fall back to the original `storyStateLockLine`.

### 6c — Update the no-text instruction

In the final prompt array, update the last element to be more explicit:

```typescript
'Child-safe, joyful and adventurous atmosphere. NO text, NO words, NO letters, NO speech bubbles, NO captions, NO written dialogue anywhere in the image. Leave clean visual space where speech bubbles will be overlaid.',
```

### 6d — Pass `characterDirections` from `generation.service.ts`

In both `generatePageImages` and `generateSceneImages` where `imageInput` is constructed, add:

```typescript
characterDirections: (page as any).characterDirections,
storyStateBlock: pageSnapshotMap.get(page.pageNumber) ?? undefined,
```

---

## Step 7 — Wire new fields through `generateSceneImages`

File: `apps/api/src/generation/generation.service.ts`

In `generateSceneImages`, similarly:
1. Instantiate `StoryStateTracker` before the scene loop
2. Pre-compute `sceneSnapshotMap` per scene (using the first page of each scene for state)
3. Pass `characterDirections` and `storyStateBlock` into `imageInput`
4. Store `speechBubbles` and `storyStateSnapshot` on pages when saving

When pages are built from scenes, forward the `speechBubbles` from the scene page data:

```typescript
pages.push({
  ...existingPageFields,
  speechBubbles: scenePageData?.speechBubbles,
  storyStateSnapshot: stateSnapshotAtPage,
});
```

---

## Step 8 — Admin Story Debug Endpoint

File: `apps/api/src/stories/stories.controller.ts` (or whichever controller serves stories)

Add a new admin-only endpoint:

```
GET /admin/stories/:id/debug
```

Response: `{ data: { pages: StoryPage[], prompt?: string, storyVisualState: StoryVisualState } }`

This returns the full pages array (including `characterDirections`, `speechBubbles`, `storyStateSnapshot`, `imagePromptUsed` if stored) from the story entity.

Check that the route guard allows `admin` role.

---

## Step 9 — `normalizeGeneratedStory` Passthrough

File: `apps/api/src/generation/generation.service.ts`

Find the `normalizeGeneratedStory` private method. In it, when building the normalized pages array, ensure the new fields are forwarded:

For each page in the normalized output, add:
```typescript
characterDirections: sourcePage.characterDirections,
speechBubbles: sourcePage.speechBubbles,
storyStateUpdate: sourcePage.storyStateUpdate,
```

---

## Acceptance Criteria

- [ ] Gemini returns `characterDirections` with concrete expressions for every page
- [ ] Gemini returns `speechBubbles` with `bubbleStyle` and `placementHint` per dialogue line
- [ ] Gemini returns `storyStateUpdate` on every page (even if empty)
- [ ] `StoryStateTracker` advances through pages in order, accumulating items/powers/companions
- [ ] Image prompts include `storyStateBlock` (the tracker's per-page summary)
- [ ] Image prompts include rich character direction (mouth open for speaking characters)
- [ ] Image prompts include explicit "NO text, NO speech bubbles" instruction
- [ ] `speechBubbles` field is saved on every `StoryPage` in the DB (new stories)
- [ ] `storyStateSnapshot` saved on each page for the debug view
- [ ] Old stories (no `speechBubbles` field) continue to work
- [ ] Admin debug endpoint returns full page metadata

## Do NOT change
- Character Canon entity, service, or module
- Auth, user, or credits system
- Narration provider
- Frontend (handled separately)
- PDF generation service
- Existing `storyVisualState` column structure in the Story entity

## One-liner for Codex

Implement Milestone 2 in `apps/api/` per CODEX_MILESTONE2_STORY_ENGINE.md: add `PageCharacterDirection`, `SpeechBubbleMetadata`, and `PageStoryStateUpdate` interfaces to `story-generation.provider.ts` and `story.entity.ts`; update Gemini prompt to output `characterDirections`, `speechBubbles`, and `storyStateUpdate` per page; implement `StoryStateTracker` class in `generation.service.ts` that pre-computes per-page state blocks before concurrent image generation; pass `characterDirections` and `storyStateBlock` into `ImageGenerationInput`; use them in `openai-image.provider.ts`; add admin debug endpoint `GET /admin/stories/:id/debug`; forward all new fields through `normalizeGeneratedStory` and both `generatePageImages` / `generateSceneImages`.

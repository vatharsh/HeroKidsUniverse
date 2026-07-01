# CODEX — Character Canon System (Milestone 1)

## Context

NestJS + TypeORM monorepo at `apps/api/`. TypeORM runs with `synchronize: true` so new entities auto-migrate.

### What already exists (do NOT duplicate)

| Entity / field | Location | Notes |
|---|---|---|
| `Hero.avatarUrl` | `src/heroes/hero.entity.ts` | Approved avatar URL |
| `Hero.avatarDescription` | same | GPT-4V text description (lazy-generated) |
| `Hero.characterIdentity` | same | JSONB `CharacterIdentity` interface — faceShape, skinTone, eyeShape, eyeColor, hairstyle, hairColor, hairLength, distinctiveFeatures[], neverChangeRules[] |
| `Character.avatarUrl` | `src/characters/entities/character.entity.ts` | Supporting character avatar |
| `Character.avatarDescription` | same | Text description |
| `CharacterVisualProfile` | `src/characters/entities/character-visual-profile.entity.ts` | Per character: costumeDescription, hairDescription, faceDescription, skinTone, eyeDescription, accessories, colors, doNotChangeRules — costume-level profile, NOT the canonical identity model |
| `UniverseCompanion.avatarUrl` | `src/companions/entities/universe-companion.entity.ts` | Optional avatar |
| `ImageGenerationProvider` | `src/ai/interfaces/image-generation.provider.ts` | Interface + `ImageGenerationInput` |
| `OpenAIImageProvider` | `src/ai/providers/openai-image.provider.ts` | Has `describeCharacterAppearance()`, `describeCharacterAppearanceFromUrl()`, `extractStructuredIdentity()`, `checkFaceConsistency()` |
| `GenerationService` | `src/generation/generation.service.ts` | Has `ensureHeroCharacterIdentity()`, `buildSupportingCharacterContext()` |
| `SETTING_DEFAULTS` | `src/admin/platform-setting.entity.ts` | Platform settings key-value store |

### Existing `CharacterIdentity` interface (on Hero)

```typescript
// src/heroes/hero.entity.ts
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

---

## Task Overview

1. Create `CharacterCanon` entity + `CharacterCanonModule`
2. Create `CharacterCanonService` with generation, backfill, and lookup
3. Update `ImageGenerationInput` to accept canon fields
4. Update `OpenAIImageProvider.buildPrompt()` to use canon
5. Fix style line that says "Pixar-style cartoon art"
6. Update `GenerationService` to load and inject canon into image generation
7. Create admin endpoint: `GET /admin/character-canons`, `POST /admin/character-canons/backfill`
8. Add platform settings: `CHARACTER_CANON_ENABLED`, `CHARACTER_CANON_MIN_QUALITY`

---

## Step 1 — Create `CharacterCanon` Entity

File: `src/characters/entities/character-canon.entity.ts`

```typescript
import {
  Column, CreateDateColumn, DeleteDateColumn,
  Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export type CanonType = 'hero' | 'supporting_character' | 'pet' | 'companion';
export type CanonStatus = 'pending' | 'complete' | 'failed' | 'needs_review';
export type CanonGeneratedFrom = 'approved_avatar' | 'manual_admin' | 'migration';

export interface CanonIdentityJson {
  approximate_age_range: string | null;
  gender_presentation_if_clear: string | null;
  skin_tone: string | null;
  face_shape: string | null;
  facial_proportions: string | null;
  eye_shape: string | null;
  eye_color_if_clear: string | null;
  eyebrow_shape: string | null;
  nose_shape: string | null;
  mouth_shape: string | null;
  smile_description: string | null;
  cheek_description: string | null;
  jawline_description: string | null;
  ear_visibility: string | null;
  hairstyle: string | null;
  hair_color: string | null;
  hair_length: string | null;
  hair_texture: string | null;
  build_visible: string | null;
  expression_default: string | null;
  glasses: boolean | null;
  facial_hair: boolean | null;
  jewellery: string | null;
  bindi: boolean | null;
  freckles: boolean | null;
  moles: string | null;
  dimples: boolean | null;
  braces: boolean | null;
  other_distinctive_features: string[];
  visual_rules: {
    must_preserve: string[];
    must_not_add: string[];
    must_not_change: string[];
    acceptable_variations: string[];
  };
}

export interface FaceMetricsJson {
  face_width_category: 'narrow' | 'medium' | 'wide' | null;
  face_length_category: 'short' | 'medium' | 'long' | null;
  eye_size_category: 'small' | 'medium' | 'large' | null;
  eye_spacing_category: 'close' | 'medium' | 'wide' | null;
  nose_size_category: 'small' | 'medium' | 'large' | null;
  mouth_width_category: 'narrow' | 'medium' | 'wide' | null;
  cheek_fullness_category: 'flat' | 'medium' | 'full' | null;
  chin_shape: 'round' | 'square' | 'pointed' | 'soft' | null;
  forehead_visibility: 'hidden' | 'partial' | 'full' | null;
  overall_face_silhouette: 'round' | 'oval' | 'heart' | 'square' | 'long' | null;
}

@Entity('character_canons')
export class CharacterCanon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  heroId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  characterId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  companionId!: string | null;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  canonType!: CanonType;

  @Column({ type: 'text', nullable: true })
  approvedAvatarUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  identityJson!: CanonIdentityJson | null;

  @Column({ type: 'text', nullable: true })
  appearanceSummary!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  neverChangeRulesJson!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  distinctiveFeaturesJson!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  faceMetricsJson!: FaceMetricsJson | null;

  @Column({ type: 'int', nullable: true })
  qualityScore!: number | null;

  @Column({ type: 'text', default: 'pending' })
  status!: CanonStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'text', default: 'approved_avatar' })
  generatedFrom!: CanonGeneratedFrom;

  @Column({ type: 'text', nullable: true })
  generationModel!: string | null;

  @Column({ type: 'int', default: 1 })
  generationVersion!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;
}
```

---

## Step 2 — Create `CharacterCanonService`

File: `src/characters/character-canon.service.ts`

Inject:
- `@InjectRepository(CharacterCanon) private readonly canonRepo: Repository<CharacterCanon>`
- `@InjectRepository(Hero) private readonly heroesRepo: Repository<Hero>`
- `@InjectRepository(Character) private readonly charactersRepo: Repository<Character>`
- `@InjectRepository(UniverseCompanion) private readonly companionsRepo: Repository<UniverseCompanion>`
- `@Inject(IMAGE_GENERATION_PROVIDER) private readonly imageProvider: ImageGenerationProvider`
- `private readonly logger = new Logger(CharacterCanonService.name)`

### `generateCanonFromAvatar(params)`

```typescript
async generateCanonFromAvatar(params: {
  heroId?: string;
  characterId?: string;
  companionId?: string;
  userId: string;
  avatarUrl: string;
  canonType: CanonType;
  generatedFrom?: CanonGeneratedFrom;
}): Promise<CharacterCanon>
```

Implementation:

1. Create a `CharacterCanon` record with `status: 'pending'`, save it.
2. Call `this.imageProvider.describeCharacterAppearanceFromUrl(params.avatarUrl)` → `rawDescription`.
3. If rawDescription is null, set `status: 'failed'`, `errorMessage: 'Vision analysis returned null'`, save, return.
4. Call GPT-4o-mini (via `this.imageProvider`'s OpenAI client, **not** the image generation client) with the following structured extraction prompt:

```
You are analyzing a children's storybook avatar to extract a detailed character canon for consistent future illustration.

Avatar description: "${rawDescription}"

Return ONLY valid JSON matching this exact structure (no markdown):
{
  "identityJson": {
    "approximate_age_range": "e.g. 7-9 years",
    "gender_presentation_if_clear": "boy/girl/unclear",
    "skin_tone": "e.g. warm medium brown",
    "face_shape": "e.g. round with soft cheeks",
    "facial_proportions": "e.g. wide forehead, compact lower face",
    "eye_shape": "e.g. almond-shaped, slightly upturned",
    "eye_color_if_clear": "e.g. dark brown or null",
    "eyebrow_shape": "e.g. naturally arched, medium thickness",
    "nose_shape": "e.g. small button nose",
    "mouth_shape": "e.g. medium width, slightly full lips",
    "smile_description": "e.g. wide open smile with visible teeth",
    "cheek_description": "e.g. round full cheeks",
    "jawline_description": "e.g. soft rounded jawline",
    "ear_visibility": "e.g. partially visible or hidden",
    "hairstyle": "e.g. short straight black hair with fringe",
    "hair_color": "e.g. very dark brown/black",
    "hair_length": "e.g. short, above ears",
    "hair_texture": "e.g. straight and fine",
    "build_visible": "e.g. slim or null if not visible",
    "expression_default": "e.g. cheerful and bright",
    "glasses": false,
    "facial_hair": false,
    "jewellery": null,
    "bindi": false,
    "freckles": false,
    "moles": null,
    "dimples": true,
    "braces": false,
    "other_distinctive_features": [],
    "visual_rules": {
      "must_preserve": ["face shape", "skin tone", "hairstyle", "hair color", "eye shape", "smile", "age appearance", "dimples"],
      "must_not_add": ["glasses", "facial hair", "bindi", "jewellery", "different hairstyle", "different skin tone"],
      "must_not_change": ["face shape", "skin tone", "hairstyle", "age appearance"],
      "acceptable_variations": ["clothing", "lighting", "background", "facial expression within age-appropriate range"]
    }
  },
  "appearanceSummary": "One dense paragraph (60-90 words) describing this character for a storybook illustrator, covering face, hair, skin, distinctive features, and style. This will be injected directly into image generation prompts.",
  "neverChangeRules": [
    "Never change the child's hairstyle.",
    "Never change the skin tone.",
    "Never enlarge the eyes into generic cartoon eyes.",
    "Never change the face shape.",
    "Never make the child look older or younger.",
    "Never add glasses — not present in approved avatar.",
    "Never add facial hair.",
    "Never remove dimples — present in approved avatar.",
    "Never make the character look like a generic cartoon child."
  ],
  "distinctiveFeatures": ["dimples", "short black fringe"],
  "faceMetrics": {
    "face_width_category": "medium",
    "face_length_category": "short",
    "eye_size_category": "medium",
    "eye_spacing_category": "medium",
    "nose_size_category": "small",
    "mouth_width_category": "medium",
    "cheek_fullness_category": "full",
    "chin_shape": "round",
    "forehead_visibility": "full",
    "overall_face_silhouette": "round"
  },
  "qualityScore": 85
}

qualityScore guidelines (0–100):
- Deduct 30 if no face clearly visible
- Deduct 20 if face is very small or distant
- Deduct 10 if face is partially obscured
- Deduct 10 if image is low quality/blurry
- Deduct 5 for each distinctive feature that cannot be confirmed
- Full score if face is clear, front or three-quarter angle, well-lit
```

5. Parse the response. Set `status: 'complete'` if qualityScore >= 70, else `status: 'needs_review'`.
6. Set `generationModel` to the model used.
7. Save and return the canon.

Wrap entire function in try/catch; on error set `status: 'failed'`, `errorMessage`, save, rethrow.

---

### `ensureCanonExists(params)`

```typescript
async ensureCanonExists(params: {
  heroId?: string;
  characterId?: string;
  companionId?: string;
  userId: string;
  avatarUrl: string | null;
  canonType: CanonType;
}): Promise<CharacterCanon | null>
```

1. Query for existing canon by `heroId`/`characterId`/`companionId` where `status = 'complete'`.
2. If found, return it.
3. If `params.avatarUrl` is null, log warning, return null.
4. Call `generateCanonFromAvatar(...)`.
5. Catch and log errors, return null — never throw from this method.

---

### `getCanonForHero(heroId)` / `getCanonForCharacter(characterId)` / `getCanonForCompanion(companionId)`

Simple repo lookups. Return null if not found.

---

### `regenerateCanon(canonId)`

Load canon, re-run `generateCanonFromAvatar` with same params, increment `generationVersion`.

---

### `backfillAll()`

```typescript
async backfillAll(): Promise<BackfillResult>
```

Where `BackfillResult = { total, processed, skipped, failed, missingAvatar, alreadyComplete }`.

1. Load all heroes, characters (with avatarUrl), companions (with avatarUrl).
2. For each, call `ensureCanonExists`. Track counts.
3. Log a summary line via `this.logger.log(...)`.
4. Return the result object.

---

## Step 3 — Create `CharacterCanonModule`

File: `src/characters/character-canon.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([CharacterCanon, Hero, Character, UniverseCompanion]),
    AiModule, // to access IMAGE_GENERATION_PROVIDER
  ],
  providers: [CharacterCanonService],
  exports: [CharacterCanonService],
})
export class CharacterCanonModule {}
```

Register `CharacterCanon` entity in `AppModule`'s TypeORM `entities` array.

---

## Step 4 — Update `ImageGenerationInput`

File: `src/ai/interfaces/image-generation.provider.ts`

Add to `ImageGenerationInput`:

```typescript
heroCanonSummary?: string;           // appearanceSummary from CharacterCanon
heroNeverChangeRules?: string[];     // neverChangeRulesJson from CharacterCanon
heroFaceMetrics?: string;            // one-line summary built from faceMetricsJson
characterCanonSummaries?: string[];  // one per supporting character, same order as supportingCharacters[]
```

---

## Step 5 — Update `OpenAIImageProvider.buildImagePrompt()`

File: `src/ai/providers/openai-image.provider.ts`

### 5a — Fix style line

Find this line (around line 134):

```typescript
input.style ?? 'vibrant full-color children\'s storybook illustration, warm Pixar-style cartoon art, expressive characters, rich colorful backgrounds',
```

Replace with:

```typescript
input.style ?? 'vibrant full-color children\'s storybook illustration, premium semi-realistic painterly style, expressive characters, rich colorful backgrounds, stylize environment and lighting but never alter facial anatomy',
```

### 5b — Upgrade `heroIdentityLine`

Replace the current `heroIdentityLine` block (the `if/else` on `input.heroAvatarDescription`) with:

```typescript
const heroIdentityLine = input.heroCanonSummary
  ? [
      `HERO CANON IDENTITY — draw ${input.heroName} EXACTLY as described. The approved avatar is an IDENTITY REFERENCE, not merely a style reference. Do not change facial anatomy:`,
      input.heroCanonSummary,
      `Age: ${input.heroAge} years old.`,
      input.heroNeverChangeRules?.length
        ? `NEVER-CHANGE RULES:\n${input.heroNeverChangeRules.map(r => `- ${r}`).join('\n')}`
        : '',
      input.heroFaceMetrics
        ? `FACE METRICS (use as anchor): ${input.heroFaceMetrics}`
        : '',
      'The artistic style may affect rendering, lighting, and colors, but must NOT change facial anatomy. Do not make the child into a generic cartoon or Pixar-style child.',
    ].filter(Boolean).join('\n')
  : input.heroAvatarDescription
    ? [
        `HERO IDENTITY — draw ${input.heroName} EXACTLY as described below in every panel:`,
        input.heroAvatarDescription,
        `Age: ${input.heroAge} years old. Preserve face shape, ears, eyes, smile, hairline, hairstyle, skin tone, and age. This is a real child — their parents must recognise them instantly.`,
      ].join(' ')
    : `The main character is ${input.heroName} (age ${input.heroAge}). ` +
      `STYLE TRANSFER the reference portrait to storybook illustration style: keep the EXACT same face shape, ` +
      `skin tone, hair colour, hair style, and eye shape. Do not invent a new character.`;
```

### 5c — Upgrade `castLine` for supporting characters

After building the current `castLine`, add canon summaries when available:

```typescript
const castLine = input.supportingCharacters?.length
  ? [
      'SUPPORTING CHARACTER IDENTITIES — draw these recurring characters consistently and exactly as described:',
      ...input.supportingCharacters.map((label, index) => {
        const canonSummary = input.characterCanonSummaries?.[index];
        const description = canonSummary ?? input.characterAvatarDescriptions?.[index];
        return description
          ? `${label}: ${description}`
          : `${label}: use the scene description and reference image if available; keep age, skin tone, hair, face, and clothing consistent.`;
      }),
    ].join('\n')
  : '';
```

---

## Step 6 — Update `GenerationService`

File: `src/generation/generation.service.ts`

### 6a — Inject `CharacterCanonService`

Add to constructor:
```typescript
private readonly characterCanonService: CharacterCanonService,
```

Import `CharacterCanonModule` in `GenerationModule`.

### 6b — Load hero canon before image generation

In the `generateStory()` method, after `ensureHeroCharacterIdentity(hero)`, add:

```typescript
const heroCanon = await this.characterCanonService.ensureCanonExists({
  heroId: hero.id,
  userId: hero.userId,
  avatarUrl: hero.avatarUrl,
  canonType: 'hero',
}).catch(() => null);
```

### 6c — Build `heroFaceMetricsSummary` helper

```typescript
private buildFaceMetricsSummary(metrics: FaceMetricsJson | null | undefined): string {
  if (!metrics) return '';
  const parts = [
    metrics.overall_face_silhouette ? `${metrics.overall_face_silhouette} face silhouette` : '',
    metrics.face_width_category ? `${metrics.face_width_category}-width face` : '',
    metrics.eye_size_category ? `${metrics.eye_size_category} eyes` : '',
    metrics.cheek_fullness_category ? `${metrics.cheek_fullness_category} cheeks` : '',
    metrics.chin_shape ? `${metrics.chin_shape} chin` : '',
  ].filter(Boolean);
  return parts.join(', ');
}
```

### 6d — Pass canon into `ImageGenerationInput`

In `generateSceneImages` and `generatePageImages`, update the `ImageGenerationInput` object to include:

```typescript
const imageInput: ImageGenerationInput = {
  // ... existing fields ...
  heroCanonSummary: heroCanon?.appearanceSummary ?? undefined,
  heroNeverChangeRules: heroCanon?.neverChangeRulesJson ?? undefined,
  heroFaceMetrics: heroCanon?.faceMetricsJson
    ? this.buildFaceMetricsSummary(heroCanon.faceMetricsJson)
    : undefined,
  characterCanonSummaries: await this.buildCharacterCanonSummaries(story, supportingChars),
};
```

### 6e — Add `buildCharacterCanonSummaries()` helper

```typescript
private async buildCharacterCanonSummaries(
  story: Story,
  supportingChars: Array<{ label: string; characterId?: string; avatarUrl: string | null; avatarDescription: string | null }>,
): Promise<string[]> {
  return Promise.all(
    supportingChars.map(async (c) => {
      if (!c.characterId) return c.avatarDescription ?? '';
      const canon = await this.characterCanonService.ensureCanonExists({
        characterId: c.characterId,
        userId: story.userId,
        avatarUrl: c.avatarUrl,
        canonType: 'supporting_character',
      }).catch(() => null);
      return canon?.appearanceSummary ?? c.avatarDescription ?? '';
    }),
  );
}
```

Note: `buildSupportingCharacterContext()` already exists and returns `{label, avatarUrl, avatarDescription}`. Extend it to also return `characterId` by updating the return type and query.

---

## Step 7 — Admin Endpoints

File: `src/admin/admin.controller.ts` (add to existing controller)

### `GET /admin/character-canons`

Query: `?status=&canonType=&page=1&limit=20`

Join with hero/character names. Return:

```json
{
  "data": [
    {
      "id": "...",
      "canonType": "hero",
      "status": "complete",
      "qualityScore": 85,
      "approvedAvatarUrl": "...",
      "appearanceSummary": "...",
      "generationVersion": 1,
      "entityName": "Siddhant",
      "userId": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "total": 42
}
```

### `POST /admin/character-canons/backfill`

Trigger `characterCanonService.backfillAll()` in background (do not await, return 202):

```json
{ "message": "Backfill started in background" }
```

Log the result via logger when it completes.

### `POST /admin/character-canons/:id/regenerate`

Call `characterCanonService.regenerateCanon(id)`. Return updated canon.

---

## Step 8 — Platform Settings

Add to `SETTING_DEFAULTS` in `src/admin/platform-setting.entity.ts`:

```typescript
CHARACTER_CANON_ENABLED:      { value: 'true', type: 'boolean', description: 'Use Character Canon system for face consistency in image generation. Falls back to avatarDescription if disabled or canon missing.' },
CHARACTER_CANON_MIN_QUALITY:  { value: '70',   type: 'number',  description: 'Minimum canon quality score to use for generation. Below this threshold, canon is marked needs_review but still used.' },
```

In `GenerationService`, read `CHARACTER_CANON_ENABLED` before loading canon:

```typescript
const canonEnabled = await this.getBooleanSetting('CHARACTER_CANON_ENABLED', true);
const heroCanon = canonEnabled
  ? await this.characterCanonService.ensureCanonExists(...).catch(() => null)
  : null;
```

---

## Step 9 — Register in AppModule

In `src/app.module.ts`:

1. Add `CharacterCanon` to the `TypeOrmModule.forRoot` entities array (or wherever other entities are registered).
2. Import `CharacterCanonModule` in the imports array.

---

## Step 10 — Frontend: Admin Character Canons Page

### 10a — Add nav entry

File: `apps/web/src/app/admin/layout.tsx`

Add to the `NAV` array, after the `ai-analytics` entry:

```typescript
{ href: "/admin/character-canons", icon: ShieldCheck, label: "Character Canons" },
```

Import `ShieldCheck` from `lucide-react` alongside the other icon imports.

---

### 10b — Create page

File: `apps/web/src/app/admin/character-canons/page.tsx`

This is a `"use client"` page. Use the same visual conventions as other admin pages (white cards, `border border-gray-200 rounded-xl`, violet accent color for buttons).

The page has three sections:

**1. Header bar**

```
Character Canons                          [Run Backfill]
Build canonical identity profiles for all heroes and characters.
```

`[Run Backfill]` is a `POST /admin/character-canons/backfill` call. On click: disable button, show "Running…", on response show toast "Backfill started in background". Re-enable after 3s.

**2. Stats row** (4 cards)

Derive from the list data:

| Card | Value |
|---|---|
| Total Canons | count of all records |
| Complete | count where status = 'complete' |
| Needs Review | count where status = 'needs_review' |
| Failed | count where status = 'failed' |

**3. Table**

Columns: Avatar · Name · Type · Status · Quality Score · Generated · Actions

Data shape from `GET /admin/character-canons?page=1&limit=20`:
```typescript
interface CanonRow {
  id: string;
  canonType: 'hero' | 'supporting_character' | 'pet' | 'companion';
  status: 'pending' | 'complete' | 'failed' | 'needs_review';
  qualityScore: number | null;
  approvedAvatarUrl: string | null;
  appearanceSummary: string | null;
  entityName: string;        // hero/character name resolved by backend
  userId: string;
  generationVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

**Avatar cell**: `<img>` 32×32 rounded-full, fallback to a grey circle with first letter of name.

**Status badge**:
- `complete` → green pill "Complete"
- `needs_review` → amber pill "Needs Review"
- `failed` → red pill "Failed"
- `pending` → gray pill "Pending"

**Quality score**: Show as colored number — green ≥ 80, amber 60–79, red < 60. Show "—" if null.

**Actions cell**: `[Regenerate]` button — calls `POST /admin/character-canons/:id/regenerate`, shows loading spinner inline, refreshes row on success.

**Pagination**: Simple prev/next buttons below the table. Show "Showing X–Y of Z".

**Filter bar** above table: `Status` dropdown (all / complete / needs_review / failed / pending) + `Type` dropdown (all / hero / supporting_character / companion). Filters are applied as query params.

**Full implementation** — no stub, no TODO comments. Use `getAccessToken()` from `@/lib/api` for auth headers. Use `BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api"`. No external state library — plain `useState` + `useEffect`.

---

## Acceptance Criteria

**Backend**
- `character_canons` table created via TypeORM sync.
- `CharacterCanonService.ensureCanonExists()` is idempotent — calling it twice for the same hero returns the existing complete canon.
- `CharacterCanonService.backfillAll()` processes all heroes and characters with avatarUrls, skips those without, skips already-complete.
- `POST /admin/character-canons/backfill` returns 202 immediately; backfill runs in background.
- `GET /admin/character-canons` returns a paged list with `entityName` resolved.
- `ImageGenerationInput` has `heroCanonSummary`, `heroNeverChangeRules`, `heroFaceMetrics`, `characterCanonSummaries`.
- Image prompt no longer contains "Pixar-style cartoon art" — replaced with painterly identity-preserving language.
- When canon is available, the prompt says "approved avatar is an IDENTITY REFERENCE, not merely a style reference."
- When canon is missing, system falls back to `avatarDescription` gracefully — no crash.
- `CHARACTER_CANON_ENABLED` platform setting toggles the system.
- No existing stories or characters break.
- No user is asked to re-upload photos.

**Frontend**
- `/admin/character-canons` page is accessible from the admin sidebar.
- Stats row shows correct counts derived from list data.
- Table shows avatar thumbnail, name, canon type, status badge, quality score, generated date.
- Regenerate button works per-row and refreshes that row.
- Run Backfill button calls the backfill endpoint and shows confirmation.
- Status and type filter dropdowns filter the table via API query params.
- Pagination works (prev/next).

---

## Files to create

```
apps/api/src/characters/entities/character-canon.entity.ts
apps/api/src/characters/character-canon.service.ts
apps/api/src/characters/character-canon.module.ts
apps/web/src/app/admin/character-canons/page.tsx
```

## Files to modify

```
apps/api/src/ai/interfaces/image-generation.provider.ts   — add canon fields to ImageGenerationInput
apps/api/src/ai/providers/openai-image.provider.ts        — upgrade heroIdentityLine, fix style line, upgrade castLine
apps/api/src/generation/generation.service.ts             — inject CharacterCanonService, load + pass canon
apps/api/src/admin/admin.controller.ts                    — add 3 new endpoints
apps/api/src/admin/platform-setting.entity.ts             — add 2 new settings
apps/api/src/app.module.ts                                — register entity + module
apps/web/src/app/admin/layout.tsx                         — add Character Canons nav entry
```

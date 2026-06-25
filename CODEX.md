# HeroKids Universe — Codex Implementation Brief

---

## PRODUCT VISION — Read This First

**HeroKids Universe is NOT a story generator. It is a living childhood universe.**

Think Marvel Universe. Think Harry Potter. Think Star Wars.
Every child owns their own persistent universe. Stories are episodes inside that universe — not isolated one-off tales.

The universe remembers everything across every story:
- Characters met (family, friends, pets, villains, robots)
- Powers and magical items earned
- Locations discovered
- Quests opened and completed
- Achievements unlocked
- Cliffhangers that carry forward to the next adventure

**Example of the vision in action:**
- Story #5: Captain Arjun earns Magic Stardust in the Crystal Cave
- Story #20: Captain Arjun uses that same Magic Stardust to rescue his father from Prison Planet

This continuity is what creates emotional attachment. Children should feel: *"This is MY world."*

Every technical decision in this file exists to support that feeling.

**What we are building in this implementation:**
The database foundation and AI layer that makes universe memory possible. The frontend will be updated separately to expose this to users. Your job is to build the backend correctly so that every story automatically extracts and persists universe memories, powers, and quests — and every future story can be generated with full awareness of the universe's history.

---

## Technical Context

NestJS + TypeORM + PostgreSQL monorepo. API lives in `apps/api/src/`.
`synchronize: true` in dev so new entities auto-migrate. No separate migration files needed.

Existing entities: `User`, `Hero`, `SupportingCharacter`, `Story`, `CreditTransaction`.
Existing modules: `auth`, `heroes`, `characters`, `stories`, `credits`, `upload`.

All responses are wrapped by `TransformInterceptor` → `{ success: true, data: T, timestamp }`.
All routes are JWT-guarded by default. Use `@Public()` decorator from `../auth/decorators/public.decorator` for unauthenticated routes.
`@CurrentUser()` decorator from `../auth/decorators/current-user.decorator` returns `{ id: string, email: string }`.

---

## Task

Implement the **Universe Layer** — the persistent memory system that makes HeroKids Universe a living world, not just a story generator.

Every child owns one Universe. Stories are episodes inside that universe. The universe remembers characters met, powers earned, villains defeated, locations discovered, and quests opened/completed across all stories.

---

## 1. New TypeORM Entities

### 1A. `apps/api/src/universes/universe.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { UniverseMemory } from './universe-memory.entity';
import { Quest } from '../quests/quest.entity';
import { HeroPower } from '../powers/hero-power.entity';
import { StoryArc } from '../story-arcs/story-arc.entity';

@Entity('universes')
export class Universe {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ type: 'uuid' }) userId!: string;

  @Column({ type: 'text' }) name!: string;           // e.g. "Arjun Universe"

  @Column({ type: 'text', nullable: true }) heroTitle!: string | null;  // e.g. "Captain Arjun"

  @Column({ type: 'text', nullable: true }) tagline!: string | null;    // e.g. "Guardian of the Stars"

  @Column({ type: 'text', nullable: true }) coverImageUrl!: string | null;

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) user!: User;
  @OneToMany(() => UniverseMemory, (m) => m.universe) memories!: UniverseMemory[];
  @OneToMany(() => Quest, (q) => q.universe) quests!: Quest[];
  @OneToMany(() => HeroPower, (p) => p.universe) powers!: HeroPower[];
  @OneToMany(() => StoryArc, (a) => a.universe) arcs!: StoryArc[];
}
```

### 1B. `apps/api/src/universes/universe-memory.entity.ts`

```typescript
export enum MemoryType {
  CharacterMet       = 'character_met',
  VillainDefeated    = 'villain_defeated',
  PowerEarned        = 'power_earned',
  ItemFound          = 'item_found',
  LocationDiscovered = 'location_discovered',
  QuestOpened        = 'quest_opened',
  QuestCompleted     = 'quest_completed',
  AchievementUnlocked= 'achievement_unlocked',
}

@Entity('universe_memories')
export class UniverseMemory {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ type: 'uuid' }) universeId!: string;

  @Column({ type: 'enum', enum: MemoryType }) type!: MemoryType;

  @Column({ type: 'text' }) title!: string;          // e.g. "Defeated Shadow Bot"

  @Column({ type: 'text', nullable: true }) detail!: string | null;  // extra description

  @Column({ type: 'uuid', nullable: true }) storyId!: string | null; // which story created this memory

  @CreateDateColumn() createdAt!: Date;

  @ManyToOne(() => Universe, (u) => u.memories, { onDelete: 'CASCADE' }) universe!: Universe;
}
```

### 1C. `apps/api/src/quests/quest.entity.ts`

```typescript
export enum QuestStatus {
  Open      = 'open',
  InProgress= 'in_progress',
  Completed = 'completed',
}

@Entity('quests')
export class Quest {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ type: 'uuid' }) universeId!: string;

  @Column({ type: 'text' }) title!: string;           // e.g. "Save Father From Prison Planet"

  @Column({ type: 'text', nullable: true }) description!: string | null;

  @Column({ type: 'enum', enum: QuestStatus, default: QuestStatus.Open }) status!: QuestStatus;

  @Column({ type: 'uuid', nullable: true }) openedInStoryId!: string | null;

  @Column({ type: 'uuid', nullable: true }) completedInStoryId!: string | null;

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;

  @ManyToOne(() => Universe, (u) => u.quests, { onDelete: 'CASCADE' }) universe!: Universe;
}
```

### 1D. `apps/api/src/powers/hero-power.entity.ts`

```typescript
@Entity('hero_powers')
export class HeroPower {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ type: 'uuid' }) universeId!: string;

  @Column({ type: 'text' }) name!: string;            // e.g. "Magic Stardust"

  @Column({ type: 'text', nullable: true }) description!: string | null;

  @Column({ type: 'text', nullable: true }) emoji!: string | null;  // e.g. "✨"

  @Column({ type: 'uuid', nullable: true }) earnedInStoryId!: string | null;

  @CreateDateColumn() createdAt!: Date;

  @ManyToOne(() => Universe, (u) => u.powers, { onDelete: 'CASCADE' }) universe!: Universe;
}
```

### 1E. `apps/api/src/story-arcs/story-arc.entity.ts`

```typescript
export enum ArcStatus {
  Active    = 'active',
  Completed = 'completed',
}

@Entity('story_arcs')
export class StoryArc {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ type: 'uuid' }) universeId!: string;

  @Column({ type: 'text' }) title!: string;           // e.g. "The Prison Planet Mission"

  @Column({ type: 'text', nullable: true }) summary!: string | null;

  @Column({ type: 'enum', enum: ArcStatus, default: ArcStatus.Active }) status!: ArcStatus;

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;

  @ManyToOne(() => Universe, (u) => u.arcs, { onDelete: 'CASCADE' }) universe!: Universe;
}
```

---

## 2. Modify Existing Entities

### 2A. `apps/api/src/stories/story.entity.ts` — add these columns

```typescript
export enum StoryMode {
  NewAdventure     = 'new_adventure',
  ContinueArc      = 'continue_arc',
  NewArc           = 'new_arc',
  Standalone       = 'standalone',
}
```

Add to `Story` entity class:
```typescript
@Column({ type: 'uuid', nullable: true }) universeId!: string | null;

@Column({ type: 'enum', enum: StoryMode, default: StoryMode.NewAdventure }) storyMode!: StoryMode;

@Column({ type: 'text', nullable: true }) storyContext!: string | null;  // user-provided context hint

@Column({ type: 'text', nullable: true }) cliffhanger!: string | null;  // AI-generated cliffhanger sentence

@Column({ type: 'uuid', nullable: true }) arcId!: string | null;        // FK to story_arcs if in an arc
```

### 2B. `apps/api/src/heroes/hero.entity.ts` — add this column

```typescript
@Column({ type: 'uuid', nullable: true }) universeId!: string | null;
```

---

## 3. New Modules to Create

Create each as a standard NestJS module with entity / service / controller / module files.

### 3A. `UniversesModule` (`apps/api/src/universes/`)

**Controller routes** (all require JWT auth, prefix `universes`):

```
POST   /universes          → create universe for current user
GET    /universes/mine     → get current user's universe (with memories, quests, powers, arcs)
PATCH  /universes/:id      → update name / heroTitle / tagline
GET    /universes/:id/timeline → all memories ordered by createdAt DESC
```

**Service methods:**

- `create(userId, dto)` — creates Universe, returns it. A user should only have ONE universe; throw `ConflictException` if one already exists.
- `findMine(userId)` — finds universe where `userId = userId`, joins memories/quests/powers/arcs, throws `NotFoundException` if none.
- `update(userId, id, dto)` — PATCH name/heroTitle/tagline.
- `getTimeline(userId, id)` — returns `UniverseMemory[]` ordered by `createdAt DESC`, verifies ownership.

**DTOs:**
```typescript
// create-universe.dto.ts
class CreateUniverseDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() heroTitle?: string;
  @IsOptional() @IsString() tagline?: string;
}

// update-universe.dto.ts — all fields optional via PartialType(CreateUniverseDto)
```

### 3B. `QuestsModule` (`apps/api/src/quests/`)

**Controller routes** (prefix `quests`):

```
GET    /quests?universeId=:id        → list quests for a universe (verify ownership via universe)
POST   /quests                       → create quest manually
PATCH  /quests/:id/complete          → mark quest completed
DELETE /quests/:id                   → delete quest
```

**DTOs:**
```typescript
class CreateQuestDto {
  @IsUUID() universeId: string;
  @IsString() @MinLength(3) title: string;
  @IsOptional() @IsString() description?: string;
}
```

### 3C. `PowersModule` (`apps/api/src/powers/`)

**Controller routes** (prefix `powers`):

```
GET    /powers?universeId=:id        → list all powers for a universe
POST   /powers                       → add power manually
DELETE /powers/:id                   → remove power
```

**DTOs:**
```typescript
class CreateHeroPowerDto {
  @IsUUID() universeId: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() emoji?: string;
}
```

### 3D. `StoryArcsModule` (`apps/api/src/story-arcs/`)

**Controller routes** (prefix `story-arcs`):

```
GET    /story-arcs?universeId=:id    → list arcs for a universe
POST   /story-arcs                   → create arc
PATCH  /story-arcs/:id/complete      → mark arc completed
```

---

## 4. Update `app.module.ts`

Register all new entities in `TypeOrmModule.forRootAsync` entities array:

```typescript
entities: [
  User, Hero, SupportingCharacter, Story, CreditTransaction,
  Universe, UniverseMemory, Quest, HeroPower, StoryArc,
]
```

Import all new modules:
```typescript
imports: [
  ...,
  UniversesModule,
  QuestsModule,
  PowersModule,
  StoryArcsModule,
]
```

---

## 5. Update `stories/dto/create-story.dto.ts`

Add optional fields:

```typescript
@IsOptional() @IsUUID()    universeId?: string;
@IsOptional() @IsEnum(StoryMode) storyMode?: StoryMode;
@IsOptional() @IsString()  storyContext?: string;  // max 500 chars
```

---

## 6. Update `generation/generation.service.ts`

### 6A. Accept universe context in `generateStory`

Change signature to accept optional universe context:

```typescript
async generateStory(storyId: string, userId: string): Promise<void>
```

Inside, after fetching the story, also fetch universe context if `story.universeId` exists:

```typescript
interface UniverseContext {
  universeName: string;
  heroTitle: string | null;
  recentMemories: string[];   // last 10 memories as plain strings
  openQuests: string[];       // titles of open quests
  heroPowers: string[];       // power names hero currently holds
  storyContext: string | null; // user-provided hint
  storyMode: StoryMode;
}
```

Inject `UniverseMemory`, `Quest`, `HeroPower`, `Universe` repositories.

Build `UniverseContext` by querying:
- `Universe` where `id = story.universeId`
- `UniverseMemory` where `universeId = story.universeId` ORDER BY `createdAt DESC` LIMIT 10
- `Quest` where `universeId = story.universeId AND status = 'open'`
- `HeroPower` where `universeId = story.universeId`

Pass to `buildPrompt`.

### 6B. Updated `buildPrompt` — universe-aware

```typescript
private buildPrompt(hero: Hero, themeDescription: string, ctx?: UniverseContext): string {
  const universeSection = ctx ? `
UNIVERSE: ${ctx.universeName}
Hero Title: ${ctx.heroTitle ?? hero.name}
Story Mode: ${ctx.storyMode}
User Story Hint: ${ctx.storyContext ?? 'none'}

Universe Memory (what has already happened):
${ctx.recentMemories.length ? ctx.recentMemories.map(m => `- ${m}`).join('\n') : '- This is the first adventure'}

Hero's Current Powers & Items:
${ctx.heroPowers.length ? ctx.heroPowers.map(p => `- ${p}`).join('\n') : '- None yet'}

Open Quests (may optionally advance one of these):
${ctx.openQuests.length ? ctx.openQuests.map(q => `- ${q}`).join('\n') : '- None'}

IMPORTANT CONTINUITY RULES:
- Reference past events naturally in the story if relevant
- The hero may use existing powers in new ways
- If storyMode is "continue_arc", the story must directly continue from the last cliffhanger
- If storyMode is "new_arc", introduce a fresh threat but keep universe consistent
- The story may earn the hero a new power or item (you will declare this in extras)
- The story may open a new quest (you will declare this in extras)
` : '';

  return `You are a creative children's storybook author for HeroKids Universe — a living world where children are heroes across many adventures.

Hero details:
- Name: ${hero.name}
- Age: ${hero.age}
- Gender: ${hero.gender}
- Adventure theme: ${themeDescription}
${universeSection}

Write an 8-page illustrated comic story where ${ctx?.heroTitle ?? hero.name} is the main hero.

Rules:
- Each page: 2-3 short sentences (max 40 words per page) suitable for age ${hero.age}
- Use simple, exciting language kids love
- Include dialogue and action
- Build to an exciting climax on page 7
- Page 8: resolve happily BUT end with a soft cliffhanger sentence that hints at the next adventure
- The hero always wins through kindness, courage, or cleverness — never violence
- Naturally reference universe history if provided

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "title": "Story title here",
  "cliffhanger": "One sentence hinting at the next adventure, e.g. As Arjun held the Magic Stardust...",
  "newPowers": ["Power Name 1"],
  "newQuests": ["Quest title that was opened in this story"],
  "newMemories": [
    { "type": "power_earned", "title": "Earned Magic Stardust", "detail": "Found in the Crystal Cave" },
    { "type": "villain_defeated", "title": "Defeated Shadow Bot", "detail": "Used teamwork and courage" },
    { "type": "location_discovered", "title": "Moon Crystal Cave", "detail": "Hidden beneath the lunar surface" }
  ],
  "pages": [
    { "pageNumber": 1, "text": "...", "sceneDescription": "..." },
    { "pageNumber": 2, "text": "...", "sceneDescription": "..." },
    { "pageNumber": 3, "text": "...", "sceneDescription": "..." },
    { "pageNumber": 4, "text": "...", "sceneDescription": "..." },
    { "pageNumber": 5, "text": "...", "sceneDescription": "..." },
    { "pageNumber": 6, "text": "...", "sceneDescription": "..." },
    { "pageNumber": 7, "text": "...", "sceneDescription": "..." },
    { "pageNumber": 8, "text": "...", "sceneDescription": "..." }
  ]
}

newMemories type must be one of: character_met, villain_defeated, power_earned, item_found, location_discovered, quest_opened, quest_completed, achievement_unlocked
newPowers and newQuests may be empty arrays if none were earned/opened.`;
}
```

### 6C. Post-generation — persist universe extracts

After successful generation, if `story.universeId` exists, persist the AI output:

```typescript
// Inside generateStory, after saving story as Completed:
if (story.universeId && generated.newMemories?.length) {
  const memories = generated.newMemories.map(m =>
    this.memoriesRepo.create({
      universeId: story.universeId,
      type: m.type,
      title: m.title,
      detail: m.detail ?? null,
      storyId: story.id,
    })
  );
  await this.memoriesRepo.save(memories);
}

if (story.universeId && generated.newPowers?.length) {
  const powers = generated.newPowers.map(name =>
    this.powersRepo.create({ universeId: story.universeId, name, earnedInStoryId: story.id })
  );
  await this.powersRepo.save(powers);
}

if (story.universeId && generated.newQuests?.length) {
  const quests = generated.newQuests.map(title =>
    this.questsRepo.create({ universeId: story.universeId, title, openedInStoryId: story.id })
  );
  await this.questsRepo.save(quests);
}

// Save cliffhanger to story
if (generated.cliffhanger) {
  await this.storiesRepo.update(storyId, { cliffhanger: generated.cliffhanger });
}
```

Inject these repos into GenerationService via its module:
- `UniverseMemory` repository
- `HeroPower` repository  
- `Quest` repository
- `Universe` repository

Update `generation.module.ts` to import `TypeOrmModule.forFeature([Story, Hero, Universe, UniverseMemory, HeroPower, Quest])`.

---

## 7. Updated `GeneratedStory` Interface

```typescript
interface GeneratedStory {
  title: string;
  cliffhanger?: string;
  newPowers?: string[];
  newQuests?: string[];
  newMemories?: Array<{ type: string; title: string; detail?: string }>;
  pages: Array<{ pageNumber: number; text: string; sceneDescription: string }>;
}
```

---

## 8. File Structure Summary

```
apps/api/src/
  universes/
    universe.entity.ts
    universe-memory.entity.ts
    universes.module.ts
    universes.service.ts
    universes.controller.ts
    dto/
      create-universe.dto.ts
      update-universe.dto.ts
  quests/
    quest.entity.ts
    quests.module.ts
    quests.service.ts
    quests.controller.ts
    dto/
      create-quest.dto.ts
  powers/
    hero-power.entity.ts
    powers.module.ts
    powers.service.ts
    powers.controller.ts
    dto/
      create-hero-power.dto.ts
  story-arcs/
    story-arc.entity.ts
    story-arcs.module.ts
    story-arcs.service.ts
    story-arcs.controller.ts
    dto/
      create-story-arc.dto.ts
```

---

## 9. Ownership / Authorization Pattern

Follow the exact pattern used in `stories.service.ts`:
- Every query filters by `userId` (via universe ownership) — never return data from another user's universe
- For quests/powers/memories: first verify the universe belongs to `currentUser.id`, then query the child records
- Use `NotFoundException` for missing records, `ForbiddenException` for wrong owner

---

## 11. Episode Recap Endpoint (NEW — Phase 2)

This is the emotional payoff of the universe system. After a story finishes generating, the frontend shows the user what their hero earned in this episode — powers, quests opened, memories created. This requires one new endpoint.

### Add to `apps/api/src/stories/stories.controller.ts`

```typescript
@Get(':id/recap')
getRecap(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
  return this.storiesService.getRecap(currentUser.id, id);
}
```

### Add to `apps/api/src/stories/stories.service.ts`

Inject three new repositories (already available if StoriesModule imports them):
- `UniverseMemory` from `../universes/universe-memory.entity`
- `HeroPower` from `../powers/hero-power.entity`
- `Quest` from `../quests/quest.entity`

```typescript
async getRecap(userId: string, storyId: string): Promise<{
  cliffhanger: string | null;
  memoriesEarned: UniverseMemory[];
  powersEarned: HeroPower[];
  questsOpened: Quest[];
}> {
  // Verify story ownership
  const story = await this.findOne(userId, storyId);

  const [memoriesEarned, powersEarned, questsOpened] = await Promise.all([
    this.memoriesRepository.find({ where: { storyId } }),
    this.powersRepository.find({ where: { earnedInStoryId: storyId } }),
    this.questsRepository.find({ where: { openedInStoryId: storyId } }),
  ]);

  return {
    cliffhanger: story.cliffhanger,
    memoriesEarned,
    powersEarned,
    questsOpened,
  };
}
```

Update `StoriesModule` to import `TypeOrmModule.forFeature` for `UniverseMemory`, `HeroPower`, `Quest` in addition to what's already there.

---

## 12. Universe Stats Endpoint (NEW — Phase 2)

Add a lightweight stats endpoint used by the dashboard header stat pills.

### Add to `apps/api/src/universes/universes.controller.ts`

```typescript
@Get('mine/stats')
getStats(@CurrentUser() currentUser: CurrentUserPayload) {
  return this.universesService.getStats(currentUser.id);
}
```

### Add to `apps/api/src/universes/universes.service.ts`

```typescript
async getStats(userId: string): Promise<{
  episodeCount: number;
  powerCount: number;
  openQuestCount: number;
  memoryCount: number;
}> {
  const universe = await this.universesRepository.findOne({ where: { userId } });
  if (!universe) return { episodeCount: 0, powerCount: 0, openQuestCount: 0, memoryCount: 0 };

  const [powerCount, openQuestCount, memoryCount] = await Promise.all([
    this.powersRepository.count({ where: { universeId: universe.id } }),
    this.questsRepository.count({ where: { universeId: universe.id, status: QuestStatus.Open } }),
    this.memoriesRepository.count({ where: { universeId: universe.id } }),
  ]);

  return { episodeCount: 0, powerCount, openQuestCount, memoryCount }; // episodeCount comes from stories endpoint
}
```

Import `QuestStatus` from `../quests/quest.entity`.

---

## 13. AI Provider Abstraction + OpenAI Integration (NEW — Phase 2)

### 13A. Core Principle

Business logic must NEVER call Gemini or OpenAI directly. All AI calls go through provider interfaces. This keeps models swappable via config with zero code changes.

---

### 13B. Environment Variables to Add

Add these to `.env` and `.env.example` (do NOT remove existing keys):

```env
# Gemini — keep existing GEMINI_API_KEY, add model config
GEMINI_MODEL=gemini-2.5-flash-lite

# OpenAI — existing key is OPEN_AI_API_KEY (note: underscore format already in use)
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_TTS_MODEL=gpt-4o-mini-tts

# Cost controls
MAX_IMAGES_PER_STORY=3
```

`MAX_IMAGES_PER_STORY=3` in dev (cover + page 1 + page 2), `9` in production (cover + 8 pages).

---

### 13C. Provider Interfaces

Create `apps/api/src/ai/interfaces/`:

**`apps/api/src/ai/interfaces/story-generation.provider.ts`**
```typescript
export interface StoryGenerationInput {
  heroName: string;
  heroAge: number;
  heroGender: string;
  themeDescription: string;
  universeContext?: UniverseContext; // same interface already in GenerationService
}

export interface StoryGenerationOutput {
  title: string;
  cliffhanger?: string;
  newPowers?: string[];
  newQuests?: string[];
  newMemories?: Array<{ type: string; title: string; detail?: string }>;
  pages: Array<{ pageNumber: number; text: string; sceneDescription: string }>;
}

export interface StoryGenerationProvider {
  generateStory(input: StoryGenerationInput): Promise<StoryGenerationOutput>;
}

export const STORY_GENERATION_PROVIDER = 'STORY_GENERATION_PROVIDER';
```

**`apps/api/src/ai/interfaces/image-generation.provider.ts`**
```typescript
export interface ImageGenerationInput {
  sceneDescription: string;
  heroName: string;
  heroAge: number;
  style?: string; // e.g. "children's comic book illustration, vibrant colors"
}

export interface ImageGenerationOutput {
  imageUrl: string;        // URL or base64 data URL
  imageBase64?: string;    // raw base64 if returned directly
}

export interface ImageGenerationProvider {
  generateImage(input: ImageGenerationInput): Promise<ImageGenerationOutput>;
}

export const IMAGE_GENERATION_PROVIDER = 'IMAGE_GENERATION_PROVIDER';
```

**`apps/api/src/ai/interfaces/narration.provider.ts`**
```typescript
export interface NarrationInput {
  text: string;
  voice?: string; // default: 'nova'
}

export interface NarrationOutput {
  audioUrl: string;       // stored URL after upload
  audioBuffer?: Buffer;   // raw audio bytes
}

export interface NarrationProvider {
  generateNarration(input: NarrationInput): Promise<NarrationOutput>;
}

export const NARRATION_PROVIDER = 'NARRATION_PROVIDER';
```

---

### 13D. Gemini Provider Implementation

`apps/api/src/ai/providers/gemini-story.provider.ts`

Move the existing story generation logic from `GenerationService.callGemini()` into this class.

```typescript
@Injectable()
export class GeminiStoryProvider implements StoryGenerationProvider {
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.genAI = new GoogleGenerativeAI(config.get<string>('GEMINI_API_KEY') ?? '');
    this.model = config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
  }

  async generateStory(input: StoryGenerationInput): Promise<StoryGenerationOutput> {
    // Move the existing retry/fallback logic here.
    // Keep the 3-model fallback chain but load primary model from this.model.
    // Fallback chain: [this.model, 'gemini-flash-lite-latest', 'gemini-2.0-flash']
    // Keep existing retry + backoff logic unchanged.
    // Build prompt using the same buildPrompt() logic already in GenerationService.
    // Return parsed JSON output.
  }
}
```

---

### 13E. OpenAI Image Provider Implementation

`apps/api/src/ai/providers/openai-image.provider.ts`

```typescript
import OpenAI from 'openai';

@Injectable()
export class OpenAIImageProvider implements ImageGenerationProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({ apiKey: config.get<string>('OPEN_AI_API_KEY') });
    this.model = config.get<string>('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
  }

  async generateImage(input: ImageGenerationInput): Promise<ImageGenerationOutput> {
    const prompt = `Children's storybook comic panel illustration. Style: vibrant, warm, safe for ages 4-12. Scene: ${input.sceneDescription}. The main character is a child named ${input.heroName}, age ${input.heroAge}.`;
    
    const response = await this.client.images.generate({
      model: this.model,
      prompt,
      n: 1,
      size: '1024x1024',
      // For gpt-image-1, response_format is always b64_json
    });

    const imageData = response.data[0];
    if (imageData.b64_json) {
      return {
        imageUrl: `data:image/png;base64,${imageData.b64_json}`,
        imageBase64: imageData.b64_json,
      };
    }
    return { imageUrl: imageData.url ?? '' };
  }
}
```

Install openai package if not already present: `npm install openai` in `apps/api`.

---

### 13F. OpenAI TTS Provider Implementation

`apps/api/src/ai/providers/openai-tts.provider.ts`

```typescript
@Injectable()
export class OpenAITTSProvider implements NarrationProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({ apiKey: config.get<string>('OPEN_AI_API_KEY') });
    this.model = config.get<string>('OPENAI_TTS_MODEL') ?? 'gpt-4o-mini-tts';
  }

  async generateNarration(input: NarrationInput): Promise<NarrationOutput> {
    const response = await this.client.audio.speech.create({
      model: this.model,
      voice: (input.voice as any) ?? 'nova',
      input: input.text,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return { audioUrl: '', audioBuffer: buffer };
    // Caller is responsible for uploading buffer to R2/local and updating audioUrl
  }
}
```

---

### 13G. AI Module

`apps/api/src/ai/ai.module.ts`

```typescript
@Module({
  providers: [
    { provide: STORY_GENERATION_PROVIDER, useClass: GeminiStoryProvider },
    { provide: IMAGE_GENERATION_PROVIDER, useClass: OpenAIImageProvider },
    { provide: NARRATION_PROVIDER,        useClass: OpenAITTSProvider },
  ],
  exports: [STORY_GENERATION_PROVIDER, IMAGE_GENERATION_PROVIDER, NARRATION_PROVIDER],
})
export class AiModule {}
```

Import `AiModule` in `AppModule` and in `GenerationModule`.

---

### 13H. New Logging Entities

**`apps/api/src/ai/entities/ai-usage-log.entity.ts`**
```typescript
export enum AiOperation {
  StoryGeneration = 'story_generation',
  ImageGeneration = 'image_generation',
  Narration       = 'narration',
  AvatarGeneration= 'avatar_generation',
}

@Entity('ai_usage_logs')
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) userId!: string | null;
  @Column({ type: 'uuid', nullable: true }) storyId!: string | null;
  @Column({ type: 'text' }) provider!: string;              // 'gemini' | 'openai'
  @Column({ type: 'text' }) model!: string;                 // actual model name used
  @Column({ type: 'enum', enum: AiOperation }) operation!: AiOperation;
  @Column({ type: 'int', default: 0 }) inputTokens!: number;
  @Column({ type: 'int', default: 0 }) outputTokens!: number;
  @Column({ type: 'int', default: 0 }) imagesGenerated!: number;
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 }) estimatedCostUsd!: number;
  @CreateDateColumn() createdAt!: Date;
}
```

**`apps/api/src/ai/entities/story-generation-log.entity.ts`**
```typescript
@Entity('story_generation_logs')
export class StoryGenerationLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) storyId!: string;
  @Column({ type: 'text' }) provider!: string;
  @Column({ type: 'text' }) model!: string;
  @Column({ type: 'text' }) prompt!: string;
  @Column({ type: 'text' }) response!: string;
  @CreateDateColumn() createdAt!: Date;
}
```

**`apps/api/src/ai/entities/story-generation-cost.entity.ts`**
```typescript
@Entity('story_generation_costs')
export class StoryGenerationCost {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) storyId!: string;
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 }) storyCostUsd!: number;
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 }) imageCostUsd!: number;
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 }) audioCostUsd!: number;
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 }) totalCostUsd!: number;
  @CreateDateColumn() createdAt!: Date;
}
```

Register all three entities in `app.module.ts` entities array.

---

### 13I. Update GenerationService to Use Abstractions + Generate Images

Refactor `apps/api/src/generation/generation.service.ts`:

1. **Inject providers via tokens** (not direct classes):
```typescript
constructor(
  @Inject(STORY_GENERATION_PROVIDER) private readonly storyProvider: StoryGenerationProvider,
  @Inject(IMAGE_GENERATION_PROVIDER) private readonly imageProvider: ImageGenerationProvider,
  @Inject(NARRATION_PROVIDER)        private readonly narrationProvider: NarrationProvider,
  @InjectRepository(AiUsageLog)      private readonly usageLogRepo: Repository<AiUsageLog>,
  @InjectRepository(StoryGenerationLog) private readonly genLogRepo: Repository<StoryGenerationLog>,
  @InjectRepository(StoryGenerationCost) private readonly costRepo: Repository<StoryGenerationCost>,
  // ... existing repos
)
```

2. **Call through interface**:
```typescript
const generated = await this.storyProvider.generateStory({ heroName: hero.name, heroAge: hero.age, heroGender: hero.gender, themeDescription, universeContext });
```

3. **Generate images respecting MAX_IMAGES_PER_STORY**:
```typescript
const maxImages = parseInt(this.config.get<string>('MAX_IMAGES_PER_STORY') ?? '3');
const pagesToImage = generated.pages.slice(0, maxImages);

// Image generation — run sequentially to avoid rate limits
const pagesWithImages = await Promise.all(
  generated.pages.map(async (p, i) => {
    if (i >= maxImages) return { ...p, imageUrl: undefined };
    try {
      const img = await this.imageProvider.generateImage({
        sceneDescription: p.sceneDescription,
        heroName: hero.name,
        heroAge: hero.age,
      });
      await this.usageLogRepo.save({ userId, storyId: story.id, provider: 'openai', model: 'gpt-image-1', operation: AiOperation.ImageGeneration, imagesGenerated: 1 });
      return { ...p, imageUrl: img.imageUrl };
    } catch {
      return { ...p, imageUrl: undefined }; // image failure is non-fatal
    }
  })
);
```

4. **Log costs after generation** — save a `StoryGenerationCost` record.

5. **Save prompt + response** in `StoryGenerationLog` for every Gemini call.

6. Image base64 strings: if `imageUrl` starts with `data:`, use `UploadService` to save locally (or to R2) and replace with the permanent URL before saving to story pages.

---

### 13J. File Structure for AI Module

```
apps/api/src/ai/
  interfaces/
    story-generation.provider.ts
    image-generation.provider.ts
    narration.provider.ts
  providers/
    gemini-story.provider.ts
    openai-image.provider.ts
    openai-tts.provider.ts
  entities/
    ai-usage-log.entity.ts
    story-generation-log.entity.ts
    story-generation-cost.entity.ts
  ai.module.ts
```

---

## 10. Notes

- DO NOT add any migrations folder — TypeORM `synchronize: true` handles schema in dev
- Follow existing code style: no semicolons after class definitions, use `!` for required entity fields
- All new entity column strings must use `{ type: 'text' }` explicitly (not bare `@Column()`) to avoid TypeORM `DataTypeNotSupportedError`
- UUID FK columns must use `{ type: 'uuid' }` explicitly
- nullable FK columns for storyId/arcId must be `{ type: 'uuid', nullable: true }`
- Use `class-validator` decorators on all DTOs (already installed)

---

## Section 14: Character System — Free-form Cast with Photo-to-Avatar

### Context

The frontend has been redesigned so characters are **free-form** (not fixed relationship slots). Users can add multiple friends, siblings, pets, villains, etc. Characters are shown in the create flow so users can pick who joins each episode.

The existing `SupportingCharacter` entity (if present) used a `relationship` field with a fixed enum. This section replaces that model entirely.

---

### 14A — Update Hero Entity

Add a `dob` (date of birth) column to the `Hero` entity. This is **mandatory** — it powers birthday rewards later.

```typescript
@Column({ type: 'date' })
dob!: string; // ISO date string e.g. "2018-04-15"
```

Also update `CreateHeroDto` and `UpdateHeroDto`:
- `CreateHeroDto`: add `@IsDateString() dob: string;` (required)
- Remove `age` from both DTOs — age will be computed from dob on the fly where needed

Hero response should include `dob` and computed `age` (current year minus birth year).

---

### 14B — Character Entity

Replace (or repurpose) the existing `SupportingCharacter` or `characters` table. The new `Character` entity:

```typescript
// apps/api/src/characters/entities/character.entity.ts
@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'other' })
  role!: string; // 'friend' | 'sibling' | 'pet' | 'villain' | 'other'

  @Column({ type: 'date', nullable: true })
  dob!: string | null;

  @Column({ type: 'text', nullable: true })
  photoUrl!: string | null; // original upload URL (temp storage)

  @Column({ type: 'text', nullable: true })
  avatarUrl!: string | null; // AI-generated cartoon avatar

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

---

### 14C — Avatar Generation from Photo

When a character is created or updated with a photo, generate a cartoon avatar using OpenAI image API.

**Approach:**
1. Accept `photo` as a `multipart/form-data` field in `POST /characters` and `PATCH /characters/:id`
2. Upload the original to Cloudflare R2 (use existing `UploadService`) → store URL as `photoUrl`
3. Call OpenAI Images to generate a cartoon/illustrated avatar from the photo description
4. Store the avatar URL as `avatarUrl`

**OpenAI call for avatar generation:**
```typescript
// Use OPEN_AI_API_KEY env var (underscore format — already in .env)
// Use gpt-image-1 model (or dall-e-3 as fallback)
// Prompt: "Create a friendly, cartoon-style illustrated avatar of a child character named [name].
//          Make it look like a storybook illustration. Colorful, warm, safe for children."
// If photo is provided, use it as a reference via image editing (openai.images.edit)
// Output: b64_json → upload to R2 → store as avatarUrl
```

If avatar generation fails, log the error and continue — `avatarUrl` stays null (UI falls back to initials).

---

### 14D — Characters Controller

```typescript
// apps/api/src/characters/characters.controller.ts

@Controller('characters')
@UseGuards(JwtAuthGuard)
export class CharactersController {
  @Get()
  findAll(@CurrentUser() user) // returns all characters for this user

  @Post()
  @UseInterceptors(FileInterceptor('photo'))
  create(@CurrentUser() user, @Body() dto: CreateCharacterDto, @UploadedFile() photo?: Express.Multer.File)
  // Accepts multipart. If photo provided: upload to R2, generate avatar.

  @Patch(':id')
  @UseInterceptors(FileInterceptor('photo'))
  update(@Param('id') id, @CurrentUser() user, @Body() dto: UpdateCharacterDto, @UploadedFile() photo?: Express.Multer.File)
  // Only allow update if character.userId === user.id

  @Delete(':id')
  remove(@Param('id') id, @CurrentUser() user)
  // Only allow delete if character.userId === user.id
}
```

---

### 14E — DTOs

```typescript
// CreateCharacterDto
export class CreateCharacterDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsOptional()
  role?: string; // defaults to 'other'

  @IsDateString() @IsOptional()
  dob?: string;
}

// UpdateCharacterDto — all fields optional (PartialType of CreateCharacterDto)
```

Note: `photo` comes via `@UploadedFile()`, not the DTO.

Also accept `avatarUrl` as a plain text field in `CreateCharacterDto` and `UpdateCharacterDto`:
```typescript
@IsUrl() @IsOptional()
avatarUrl?: string; // used when user picks a preset avatar (DiceBear CDN URL or similar)
```

Priority in service:
1. If `photo` file is provided → generate avatar from photo → store as `avatarUrl` (ignores any `avatarUrl` text field)
2. Else if `avatarUrl` text field provided → store it directly as `avatarUrl`
3. Else → `avatarUrl` remains null

---

### 14F — Update Story Creation to Accept characterIds

In `CreateStoryDto`, add:
```typescript
@IsArray() @IsOptional() @IsUUID('4', { each: true })
characterIds?: string[];
```

In `StoriesService.create()`:
- Accept `characterIds` from DTO
- Fetch the character names from DB for any valid IDs belonging to the user
- Include character names in the AI story generation prompt context:
  ```
  Supporting characters in this episode: [name (role), name (role), ...]
  ```
- Store `characterIds` as a JSON column on Story (or a junction table — JSON column is fine for now):
  ```typescript
  @Column({ type: 'jsonb', nullable: true })
  characterIds!: string[] | null;
  ```

---

### 14G — Module Wiring

In `CharactersModule`:
- Import `TypeOrmModule.forFeature([Character])`
- Import `UploadModule` (to reuse upload service for photo storage)
- Add `AiModule` or inject `ImageGenerationProvider` token for avatar generation
- Export `CharactersService` (so `StoriesModule` can import it to resolve character names)

In `AppModule`:
- Ensure `CharactersModule` is in imports (it may already be — just verify it uses the new entity)

---

### 14H — File Structure

```
apps/api/src/characters/
  characters.controller.ts   ← updated
  characters.service.ts      ← updated (avatar gen + R2 upload)
  characters.module.ts       ← updated
  dto/
    create-character.dto.ts  ← new fields
    update-character.dto.ts  ← new fields
  entities/
    character.entity.ts      ← new schema (replaces old SupportingCharacter)
```
- Export each entity from its own file; import in `app.module.ts` entities array

---

## Section 15: Avatar Generation Service — Standalone Endpoint with Limits

The frontend now calls a **dedicated avatar generation endpoint** (`POST /avatars/generate`) instead of piggybacking on character/hero save. Avatar generation is decoupled from record persistence. A generated avatar returns a permanent R2 URL that the caller then saves separately via `PATCH /heroes/:id` or `PATCH /characters/:id`.

**Why decoupled?** The user confirms the privacy modal and generation before saving. The generated avatar URL goes into the normal `avatarUrl` field on hero/character — no special handling in those endpoints.

---

### 15A — User Entity: Generation Counters

Add two integer columns to the `User` entity (TypeORM `synchronize: true` handles migration):

```typescript
@Column({ type: "int", default: 0 })
heroAvatarGenerationsUsed: number;   // max 2

@Column({ type: "int", default: 0 })
characterAvatarGenerationsUsed: number; // max 3 total across all characters
```

Constants (in `avatars.service.ts`):
```typescript
const HERO_AVATAR_MAX      = 2;
const CHARACTER_AVATAR_MAX = 3;
```

---

### 15B — UserAvatar Entity

Track every generated avatar for a user (so they can reuse them in future pickers):

```typescript
// apps/api/src/avatars/entities/user-avatar.entity.ts
@Entity("user_avatars")
export class UserAvatar {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column()
  avatarUrl: string; // permanent R2 URL of the generated avatar

  @Column({ default: "hero" })
  type: "hero" | "character"; // which generation quota it consumed

  @CreateDateColumn()
  createdAt: Date;
}
```

Add to `app.module.ts` entities array.

---

### 15C — Avatars Service

```typescript
// apps/api/src/avatars/avatars.service.ts
@Injectable()
export class AvatarsService {
  constructor(
    @InjectRepository(UserAvatar) private avatarRepo: Repository<UserAvatar>,
    @InjectRepository(User)       private userRepo: Repository<User>,
    private imageGen: ImageGenerationProvider, // already exists from Section 14C
    private r2: R2Service,                     // already exists
  ) {}

  async getStats(userId: string): Promise<{
    customAvatars: string[];
    heroGenerationsUsed: number;
    heroGenerationsMax: number;
    characterGenerationsUsed: number;
    characterGenerationsMax: number;
  }> {
    const user    = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const avatars = await this.avatarRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
    });

    return {
      customAvatars:            avatars.map(a => a.avatarUrl),
      heroGenerationsUsed:      user.heroAvatarGenerationsUsed,
      heroGenerationsMax:       HERO_AVATAR_MAX,
      characterGenerationsUsed: user.characterAvatarGenerationsUsed,
      characterGenerationsMax:  CHARACTER_AVATAR_MAX,
    };
  }

  async generate(
    userId: string,
    photoBuffer: Buffer,
    mimeType: string,
    type: "hero" | "character",
  ): Promise<{ avatarUrl: string }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    // Check limits
    if (type === "hero" && user.heroAvatarGenerationsUsed >= HERO_AVATAR_MAX) {
      throw new BadRequestException("Hero avatar generation limit reached");
    }
    if (type === "character" && user.characterAvatarGenerationsUsed >= CHARACTER_AVATAR_MAX) {
      throw new BadRequestException("Character avatar generation limit reached");
    }

    // Generate illustrated avatar via OpenAI
    // Reuse the same pattern from Section 14C (ImageGenerationProvider)
    const avatarBuffer = await this.imageGen.generateAvatar(photoBuffer, mimeType);

    // Upload avatar to R2
    const key       = `avatars/${userId}/${type}-${Date.now()}.png`;
    const avatarUrl = await this.r2.upload(key, avatarBuffer, "image/png");
    // NOTE: photoBuffer is NEVER stored — it is discarded here after generation

    // Persist record + increment counter atomically
    await this.avatarRepo.save(
      this.avatarRepo.create({ user: { id: userId }, avatarUrl, type }),
    );

    if (type === "hero") {
      await this.userRepo.increment({ id: userId }, "heroAvatarGenerationsUsed", 1);
    } else {
      await this.userRepo.increment({ id: userId }, "characterAvatarGenerationsUsed", 1);
    }

    return { avatarUrl };
  }
}
```

---

### 15D — Avatars Controller

```typescript
// apps/api/src/avatars/avatars.controller.ts
@Controller("avatars")
@UseGuards(JwtAuthGuard)
export class AvatarsController {
  constructor(private avatarsService: AvatarsService) {}

  // Returns user's generated avatars + generation limits
  @Get()
  async getStats(@CurrentUser() user: { id: string }) {
    return this.avatarsService.getStats(user.id);
  }

  // Generate avatar from uploaded photo
  @Post("generate")
  @UseInterceptors(FileInterceptor("photo"))
  async generate(
    @CurrentUser() user: { id: string },
    @UploadedFile() photo: Express.Multer.File,
    @Body("type") type: "hero" | "character",
  ) {
    if (!photo) throw new BadRequestException("photo is required");
    if (!["hero", "character"].includes(type)) {
      throw new BadRequestException("type must be hero or character");
    }
    return this.avatarsService.generate(
      user.id,
      photo.buffer,
      photo.mimetype,
      type,
    );
  }
}
```

---

### 15E — ImageGenerationProvider (avatar method)

If not already implemented from Section 14C, add this method to `ImageGenerationProvider`:

```typescript
async generateAvatar(photoBuffer: Buffer, mimeType: string): Promise<Buffer> {
  // Convert photo to base64 for OpenAI
  const base64 = photoBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // Use GPT-Image-1 to transform into illustrated cartoon avatar
  const response = await this.openai.images.edit({
    model: "gpt-image-1",
    image: await toFile(photoBuffer, "photo.jpg", { type: mimeType }),
    prompt: "Transform this photo into a friendly, vibrant, cartoon-style illustrated avatar for a children's storybook app. Flat digital art style, bright colours, suitable for ages 4-12. No text. Square format.",
    n: 1,
    size: "512x512",
  });

  const imageUrl = response.data[0].url;
  if (!imageUrl) throw new Error("No image returned from OpenAI");

  // Fetch the generated image and return as Buffer
  const imageRes = await fetch(imageUrl);
  const arrayBuf = await imageRes.arrayBuffer();
  return Buffer.from(arrayBuf);
}
```

---

### 15F — Module Wiring

```typescript
// apps/api/src/avatars/avatars.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([UserAvatar, User]),
    // Import whichever module exports ImageGenerationProvider and R2Service
  ],
  controllers: [AvatarsController],
  providers:   [AvatarsService],
})
export class AvatarsModule {}
```

Register `AvatarsModule` in `app.module.ts` imports array.

---

### 15G — File Structure

```
apps/api/src/avatars/
  avatars.controller.ts
  avatars.service.ts
  avatars.module.ts
  entities/
    user-avatar.entity.ts
```

---

### 15H — Important Constraints

- **Photo is NEVER stored.** `photoBuffer` is used in-memory only; it is discarded after `generateAvatar()` returns. Do not write it to R2 or the database.
- Generation limits (`HERO_AVATAR_MAX = 2`, `CHARACTER_AVATAR_MAX = 3`) are enforced server-side; the frontend showing the remaining count is purely informational.
- The `UserAvatar` table is append-only — never delete records (so the user's "Mine" tab stays populated across sessions).
- The `avatarUrl` returned from `POST /avatars/generate` is a permanent R2 URL. The caller saves it via the normal `PATCH /heroes/:id` or `PATCH /characters/:id` endpoints (with `{ avatarUrl: "..." }` in the JSON body). Those endpoints require no changes — they already accept `avatarUrl` as a text field.
- Wrap the generate + increment operations in a try/catch: if R2 upload fails, do not increment the counter.

# CODEX — Prompt Registry: Backend Implementation

## Context

HeroKids Universe is a NestJS + Next.js monorepo.
- API: `apps/api/src/`
- TypeORM with `synchronize: true` (non-production)
- Global `TransformInterceptor` wraps all responses: `{ success, data, timestamp }`
- Global `JwtAuthGuard` + `RolesGuard`. Admin routes use `@Roles('admin')`
- Entity primary keys: UUID via `@PrimaryGeneratedColumn('uuid')`
- All column names stay camelCase (TypeORM default — do NOT use SnakeCaseNamingStrategy)

## What Already Exists (DO NOT duplicate)

- `apps/api/src/admin/platform-setting.entity.ts` — platform key-value store
- `apps/api/src/ai/entities/story-qa-run.entity.ts` — QA run records
- `apps/api/src/admin/admin.controller.ts` — admin CRUD endpoints
- `apps/api/src/admin/admin.module.ts` — AdminModule
- `apps/api/src/app.module.ts` — root module with TypeORM entities list
- `apps/api/src/ai/ai.module.ts` — AI provider module

## Task

Implement a Prompt Registry. Do not touch existing generation code.
All changes are additive. Use fallbacks everywhere.

---

## Step 1 — Create 3 Entities

### `apps/api/src/ai/entities/prompt-template.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PromptTemplateVersion } from './prompt-template-version.entity';

export const PROMPT_TYPES = [
  'avatar_generation','avatar_regeneration','character_vision','character_canon',
  'story_generation','scene_generation','image_generation','narration','speech_bubble',
  'identity_qa','story_qa','expression_qa','dialogue_qa','composition_qa',
  'confidence_engine','merchandise_preview','companion_generation',
] as const;

@Entity('prompt_templates')
export class PromptTemplate {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) promptKey!: string;
  @Column() name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'text' }) promptType!: string;
  @Column({ type: 'text', nullable: true }) provider!: string | null;
  @Column({ type: 'text', nullable: true }) defaultModel!: string | null;
  @Column({ default: true }) isActive!: boolean;
  @Column({ default: false }) isSystemPrompt!: boolean;
  @Column({ default: false }) isDeleted!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) deletedBy!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @OneToMany(() => PromptTemplateVersion, v => v.promptTemplate, { cascade: false }) versions!: PromptTemplateVersion[];
}
```

### `apps/api/src/ai/entities/prompt-template-version.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PromptTemplate } from './prompt-template.entity';

export type VersionStatus = 'draft' | 'active' | 'inactive' | 'archived';

@Entity('prompt_template_versions')
export class PromptTemplateVersion {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) promptTemplateId!: string;
  @ManyToOne(() => PromptTemplate, t => t.versions) @JoinColumn({ name: 'promptTemplateId' }) promptTemplate!: PromptTemplate;
  @Column({ type: 'text' }) version!: string;
  @Column({ type: 'text', nullable: true }) title!: string | null;
  @Column({ type: 'text' }) promptText!: string;
  @Column({ type: 'text', nullable: true }) systemInstructions!: string | null;
  @Column({ type: 'jsonb', nullable: true }) outputSchemaJson!: object | null;
  @Column({ type: 'jsonb', nullable: true }) variablesJson!: object | null;
  @Column({ type: 'text', nullable: true }) changeNotes!: string | null;
  @Column({ type: 'text', default: 'draft' }) status!: VersionStatus;
  @Column({ default: false }) isCurrent!: boolean;
  @Column({ type: 'uuid', nullable: true }) createdByUserId!: string | null;
  @Column({ type: 'uuid', nullable: true }) approvedByUserId!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) approvedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) activatedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) deactivatedAt!: Date | null;
  @Column({ default: false }) isDeleted!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) deletedBy!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
```

### `apps/api/src/ai/entities/prompt-run-snapshot.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('prompt_run_snapshots')
export class PromptRunSnapshot {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) storyGenerationRunId!: string | null;
  @Column({ type: 'uuid', nullable: true }) storyId!: string | null;
  @Column({ type: 'uuid', nullable: true }) userId!: string | null;
  @Column({ type: 'uuid' }) promptTemplateId!: string;
  @Column({ type: 'uuid' }) promptTemplateVersionId!: string;
  @Column({ type: 'text' }) promptKey!: string;
  @Column({ type: 'text' }) version!: string;
  @Column({ type: 'text', nullable: true }) provider!: string | null;
  @Column({ type: 'text', nullable: true }) model!: string | null;
  @Column({ type: 'text' }) resolvedPromptText!: string;
  @Column({ type: 'jsonb', nullable: true }) resolvedVariablesJson!: object | null;
  @CreateDateColumn() createdAt!: Date;
}
```

---

## Step 2 — Create PromptRegistryService

File: `apps/api/src/ai/prompt-registry.service.ts`

Injectable NestJS service. Inject repositories for all 3 entities.
Also inject DataSource for raw queries.

### Methods to implement

#### `listTemplates(params: { page?: number; limit?: number; promptType?: string; search?: string; isActive?: boolean })`

Return paginated array of templates. Each row includes:
- All template fields
- `currentVersion`: the version string of the `isCurrent=true` version (null if none)
- `currentVersionId`: the id of the current version (null if none)  
- `currentVersionStatus`: the status of the current version (null if none)
- `totalVersions`: count of non-deleted versions

Use LEFT JOIN or subquery on `prompt_template_versions` where `isCurrent = true` and `isDeleted = false`.
Filter `isDeleted = false` on templates.

#### `getTemplate(id: string)`

Return full template + all non-deleted versions sorted by createdAt DESC.

#### `createTemplate(dto: { promptKey, name, description?, promptType, provider?, defaultModel?, isSystemPrompt? })`

Validate promptKey is unique. Throw `ConflictException` if duplicate.
Return created template.

#### `updateTemplate(id: string, dto: Partial<{ name, description, promptType, provider, defaultModel, isActive }>)`

Update only the provided fields. Return updated template.

#### `softDeleteTemplate(id: string, userId: string)`

Set `isDeleted = true`, `deletedAt = NOW()`, `deletedBy = userId`.
Also soft-delete all versions of this template.

#### `getVersions(templateId: string, params: { page?: number; limit?: number })`

Return paginated versions for this template where `isDeleted = false`, sorted by createdAt DESC.

#### `getVersion(versionId: string)`

Return single version. Throw `NotFoundException` if not found or deleted.

#### `createVersion(templateId: string, dto: { version, title?, promptText, systemInstructions?, outputSchemaJson?, variablesJson?, changeNotes? }, userId: string)`

- Validate version string is unique within this template (among non-deleted versions)
- Throw `ConflictException` if duplicate version
- New version always starts with `status = 'draft'`, `isCurrent = false`
- Return created version

#### `updateVersion(versionId: string, dto: Partial<{ title, promptText, systemInstructions, outputSchemaJson, variablesJson, changeNotes }>)`

Only allow updating `draft` versions. Throw `BadRequestException` if status is not `draft`.

#### `activateVersion(versionId: string, userId: string)`

Within a transaction:
1. Find the version; throw `NotFoundException` if missing.
2. Throw `BadRequestException` if already active or archived.
3. Set all other versions of the same template where `isCurrent = true` to `isCurrent = false`, `status = 'inactive'`, `deactivatedAt = NOW()`.
4. Set this version: `status = 'active'`, `isCurrent = true`, `activatedAt = NOW()`, `approvedByUserId = userId`, `approvedAt = NOW()`.
5. Return updated version.

#### `archiveVersion(versionId: string)`

- Throw `BadRequestException` if version is currently active (`isCurrent = true`). Must deactivate first.
- Set `status = 'archived'`.

#### `duplicateVersion(versionId: string, userId: string)`

- Load source version.
- Generate new version string: append `-copy` to original, e.g. `1.0.0` → `1.0.0-copy`. If that exists, try `1.0.0-copy2`, etc.
- Create new version with same promptText, systemInstructions, outputSchemaJson, variablesJson; status = `draft`; isCurrent = false; changeNotes = `Duplicated from v${source.version}`.
- Return new version.

#### `rollback(versionId: string, userId: string)`

Same as `activateVersion` but sets changeNotes = `Rolled back to v${version}` on the version being activated.

#### `getActivePrompt(promptKey: string): Promise<PromptTemplateVersion | null>`

Find the template by promptKey where `isDeleted = false`.
Find its version where `isCurrent = true` and `isDeleted = false`.
Return version or null.

#### `renderPrompt(templateText: string, variables: Record<string, string>): string`

Replace `{{variableName}}` with `variables[variableName]`. Leave unmatched variables as-is.

#### `saveRunSnapshot(dto: { storyGenerationRunId?, storyId?, userId?, promptTemplateId, promptTemplateVersionId, promptKey, version, provider?, model?, resolvedPromptText, resolvedVariablesJson? })`

Insert a new `PromptRunSnapshot` row. Return created entity.

#### `getVersionPerformance(versionId: string)`

Return an object with:
```typescript
{
  storiesGenerated: number;
  avgIdentityScore: number | null;
  avgStoryScore: number | null;
  avgOverallConfidence: number | null;
  avgRetries: number | null;
  passRate: number | null;
}
```

Query `story_qa_runs` table joining on `storyPromptVersion` = version string.
Use raw SQL. All column names in story_qa_runs are camelCase — quote them: `"overallConfidence"`, `"avgIdentityScore"`, `"pagesRetried"`, `"overallStatus"`.

#### `compareVersions(leftVersionId: string, rightVersionId: string)`

Return:
```typescript
{ left: PromptTemplateVersion; right: PromptTemplateVersion; }
```

---

## Step 3 — Create PromptRegistryController

File: `apps/api/src/admin/prompt-registry.controller.ts`

```typescript
@Controller('admin/ai/prompts')
@Roles('admin')
export class PromptRegistryController {
  constructor(private readonly registry: PromptRegistryService) {}
  // ... endpoints below
}
```

Import `Roles` from `'../auth/decorators/roles.decorator'`.
Import `CurrentUser`, `CurrentUserPayload` from `'../auth/decorators/current-user.decorator'`.

### Endpoints

```
GET  /admin/ai/prompts/templates
  @Query: page, limit, promptType, search, isActive
  → registry.listTemplates(params)

POST /admin/ai/prompts/templates
  @Body: { promptKey, name, description?, promptType, provider?, defaultModel?, isSystemPrompt? }
  → registry.createTemplate(body)

GET  /admin/ai/prompts/templates/:id
  → registry.getTemplate(id)

PATCH /admin/ai/prompts/templates/:id
  @Body: Partial<{ name, description, promptType, provider, defaultModel, isActive }>
  → registry.updateTemplate(id, body)

DELETE /admin/ai/prompts/templates/:id
  @CurrentUser user
  → registry.softDeleteTemplate(id, user.id)

GET  /admin/ai/prompts/templates/:id/versions
  @Query: page, limit
  → registry.getVersions(id, params)

POST /admin/ai/prompts/templates/:id/versions
  @CurrentUser user
  @Body: { version, title?, promptText, systemInstructions?, outputSchemaJson?, variablesJson?, changeNotes? }
  → registry.createVersion(id, body, user.id)

GET  /admin/ai/prompts/versions/:versionId
  → registry.getVersion(versionId)

PATCH /admin/ai/prompts/versions/:versionId
  @Body: Partial<{ title, promptText, systemInstructions, outputSchemaJson, variablesJson, changeNotes }>
  → registry.updateVersion(versionId, body)

POST /admin/ai/prompts/versions/:versionId/activate
  @CurrentUser user
  → registry.activateVersion(versionId, user.id)

POST /admin/ai/prompts/versions/:versionId/archive
  → registry.archiveVersion(versionId)

POST /admin/ai/prompts/versions/:versionId/duplicate
  @CurrentUser user
  → registry.duplicateVersion(versionId, user.id)

POST /admin/ai/prompts/versions/:versionId/rollback
  @CurrentUser user
  → registry.rollback(versionId, user.id)

GET  /admin/ai/prompts/versions/:versionId/performance
  → registry.getVersionPerformance(versionId)

GET  /admin/ai/prompts/compare
  @Query: leftVersionId, rightVersionId
  → registry.compareVersions(leftVersionId, rightVersionId)
```

All methods return the service result directly (do NOT wrap in `{ data }`).
The global TransformInterceptor handles wrapping.

---

## Step 4 — Create PromptRegistryModule

File: `apps/api/src/ai/prompt-registry.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([PromptTemplate, PromptTemplateVersion, PromptRunSnapshot]),
  ],
  providers: [PromptRegistryService],
  exports: [PromptRegistryService],
})
export class PromptRegistryModule {}
```

---

## Step 5 — Create Seeder

File: `apps/api/src/ai/prompt-registry-seed.service.ts`

Injectable service that implements `OnModuleInit`.

In `onModuleInit()`, call `seed()`.

In `seed()`:
- For each template in the list below, check if a template with that `promptKey` already exists.
- If it does not exist, create the template and one version (v1.0.0, status: active, isCurrent: true, changeNotes: "Initial migration from hardcoded implementation.").
- If it already exists, skip it.
- Do all of this silently (catch errors, log warnings, never throw).

Templates to seed (use `promptText` = `"[Prompt text managed in code — see service implementation. Migrate here when ready.]"` for all initial versions):

| promptKey | name | promptType | provider | defaultModel |
|---|---|---|---|---|
| story_generation | Story Generation | story_generation | gemini | gemini-2.5-flash-lite |
| image_generation | Image Generation | image_generation | openai | gpt-image-1 |
| narration | Narration (TTS) | narration | openai | gpt-4o-mini-tts |
| avatar_generation | Avatar Generation | avatar_generation | openai | gpt-image-1 |
| avatar_regeneration | Avatar Regeneration | avatar_regeneration | openai | gpt-image-1 |
| character_vision | Character Vision Analysis | character_vision | gemini | gemini-2.5-flash-lite |
| character_canon | Character Canon Generation | character_canon | gemini | gemini-2.5-flash-lite |
| scene_generation | Scene Generation | scene_generation | openai | gpt-image-1 |
| speech_bubble | Speech Bubble | speech_bubble | gemini | gemini-2.5-flash-lite |
| identity_qa | Identity QA | identity_qa | openai | gpt-4o-mini |
| story_qa | Story QA | story_qa | gemini | gemini-2.5-flash-lite |
| expression_qa | Expression QA | expression_qa | gemini | gemini-2.5-flash-lite |
| dialogue_qa | Dialogue QA | dialogue_qa | gemini | gemini-2.5-flash-lite |
| composition_qa | Composition QA | composition_qa | openai | gpt-4o-mini |
| confidence_engine | Confidence Engine | confidence_engine | gemini | gemini-2.5-flash-lite |
| merchandise_preview | Merchandise Preview | merchandise_preview | openai | gpt-image-1 |
| companion_generation | Companion Generation | companion_generation | openai | gpt-image-1 |

Add `PromptRegistrySeedService` to the providers list in `PromptRegistryModule`.

---

## Step 6 — Wire into AdminModule

Edit `apps/api/src/admin/admin.module.ts`:

1. Import `PromptRegistryModule` from `'../ai/prompt-registry.module'`.
2. Add `PromptRegistryModule` to the `imports` array.
3. Add `PromptRegistryController` to the `controllers` array.

---

## Step 7 — Register Entities in AppModule

Edit `apps/api/src/app.module.ts`:

Add these 3 imports:
```typescript
import { PromptTemplate } from './ai/entities/prompt-template.entity';
import { PromptTemplateVersion } from './ai/entities/prompt-template-version.entity';
import { PromptRunSnapshot } from './ai/entities/prompt-run-snapshot.entity';
```

Add all 3 to the `entities` array inside `TypeOrmModule.forRootAsync`:
```typescript
PromptTemplate,
PromptTemplateVersion,
PromptRunSnapshot,
```

---

## Step 8 — Export PromptRegistryService from AiModule (optional, for generation pipeline)

Later, when wiring up generation services to use the registry:
- Import `PromptRegistryModule` into any module that needs `getActivePrompt`.
- Call `registry.getActivePrompt(promptKey)` then `registry.renderPrompt(version.promptText, variables)`.
- If null is returned (no active version), fall back to existing hardcoded prompt.

Do NOT modify any generation service in this task. Only wire when explicitly requested.

---

## Rules

- Do NOT touch `generation.service.ts`, `gemini-story.provider.ts`, `openai-image.provider.ts`, or any QA service.
- Do NOT change any existing entity.
- Do NOT change any existing controller endpoint.
- Do NOT remove the 3 simple version fields from platform_settings — they still work as the legacy fallback.
- All new APIs must be admin-only (`@Roles('admin')`).
- The seeder must never throw — use try/catch around each template creation.
- Test: after implementation, `GET /admin/ai/prompts/templates` should return 17 seeded templates.

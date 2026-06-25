# Codex Prompt — Companion System Backend

## Task: Implement the Companion System Backend

### Context
NestJS + TypeORM + PostgreSQL monorepo at `apps/api/src/`.
- `synchronize: true` in dev (schema auto-migrates)
- JWT auth via `@CurrentUser()` decorator
- Standard module pattern: look at `apps/api/src/characters/` for reference
- The frontend already sends `companionType`, `companionName`, and optionally `companionPetId` in the story creation POST body (these fields are currently ignored by the backend)

---

### 1. Create the entity

**File: `apps/api/src/companions/entities/universe-companion.entity.ts`**

```typescript
export enum CompanionType {
  Dragon         = 'Dragon',
  Phoenix        = 'Phoenix',
  Robot          = 'Robot',
  MagicalFox     = 'MagicalFox',
  SpiritWolf     = 'SpiritWolf',
  Unicorn        = 'Unicorn',
  TransformedPet = 'TransformedPet',
  Other          = 'Other',
}

@Entity('universe_companions')
export class UniverseCompanion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() universeId: string;
  @Column({ nullable: true }) petCharacterId?: string;
  @Column({ type: 'enum', enum: CompanionType }) type: CompanionType;
  @Column() name: string;
  @Column({ nullable: true, type: 'text' }) description?: string;
  @Column({ nullable: true }) avatarUrl?: string;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

---

### 2. Create `CompanionsModule`

**`apps/api/src/companions/companions.module.ts`** — standard forFeature module

**`apps/api/src/companions/companions.service.ts`** — methods:
- `getByUniverse(universeId: string)` → `UniverseCompanion | null`
- `createOrReplace(userId: string, universeId: string, dto: CreateCompanionDto)` → `UniverseCompanion`
  - Validate that the universe belongs to `userId` by querying `universes` table
  - Deactivate any existing active companion for that universe (`isActive = false`)
  - Create and return the new companion
- `remove(userId: string, companionId: string)` → void

**`apps/api/src/companions/companions.controller.ts`**:
- `GET /companions/universe/:universeId` → `getByUniverse`
- `POST /companions/universe/:universeId` → `createOrReplace`
- `DELETE /companions/:id` → `remove`

**`apps/api/src/companions/dto/create-companion.dto.ts`**:
```typescript
class CreateCompanionDto {
  @IsEnum(CompanionType) type: CompanionType;
  @IsString() @MaxLength(50) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsUUID() petCharacterId?: string;
}
```

---

### 3. Register in AppModule

Add `CompanionsModule` to `apps/api/src/app.module.ts` imports.

---

### 4. Integrate with Story Creation

In `apps/api/src/stories/stories.service.ts`, in the `create()` method:

**a)** Accept three new optional fields on the existing CreateStoryDto:
```typescript
companionType?: string;
companionName?: string;
companionPetId?: string;
```

**b)** After the universe is resolved, check for an existing companion:
```typescript
const existingCompanion = universeId
  ? await this.companionsService.getByUniverse(universeId)
  : null;
```

**c)** If `companionType` was passed AND no active companion exists yet, create one:
```typescript
if (companionType && !existingCompanion && universeId) {
  await this.companionsService.createOrReplace(userId, universeId, {
    type: companionType as CompanionType,
    name: companionName || companionType,
    petCharacterId: companionPetId,
  });
}
```

**d)** When building the AI story prompt, include companion context if one exists:
```typescript
const companion = existingCompanion ?? (companionType ? { name: companionName || companionType, type: companionType } : null);
if (companion) {
  storyPrompt += `\nThe hero's loyal companion is ${companion.name} (a ${companion.type}), who accompanies them on this adventure and grows alongside the hero across every future episode.`;
}
```

---

### Reference files
- `apps/api/src/characters/` — same pattern for entity, service, controller, module
- `apps/api/src/universes/` — for universe ownership validation
- `apps/api/src/stories/stories.service.ts` — where to inject CompanionsService and add companion to the generation prompt

### Expected output
List all files created/modified with a one-line summary of each change.

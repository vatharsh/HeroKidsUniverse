# Codex Task: Story Image Quality Fix — Cross-Scene Consistency, Speech Bubbles, Face QA (No Photo Persistence)

## One-line prompt for Codex

`Run the full jest suite plus ai-quality-assurance.service.spec.ts, then drive the app end-to-end (login as vatharsh@gmail.com/admin@123, edit hero Siddhant Vats's photo to confirm no raw photo is persisted anywhere, then generate a multi-page story and verify page 1/mid-story/page-specific-expression images share consistent hair+costume+face and that speech bubble tails land near the speaker's mouth) — report any regressions.`

---

## Full context for Codex

### What was built

HeroKids Universe generates personalised storybooks: a child's photo → stylised cartoon avatar → AI-generated story scene illustrations (gpt-image-1 via `images.edit`, multi-reference) → app-rendered speech bubbles overlaid on the illustrations. Parents were reporting three problems:
1. The child in story pages doesn't look like their child.
2. The character's look (hair, costume, face) changes page-to-page within the same story.
3. Speech bubbles don't point at the right mouth.

A prior in-flight change (already on `main` before this session) added `styleReferenceUrl` — scene 1's output image passed as a 3rd reference image to `images.edit` for later scenes — but it didn't reach every code path and wasn't the full fix.

### What was fixed in this session

**1. `apps/api/src/generation/generation.service.ts` — the single highest-impact fix.**
The per-page "page-specific expression" regeneration block (triggers when a page needs a different expression from its scene's base image, e.g. a speaking close-up) built a fresh `ImageGenerationInput` **without** `styleReferenceUrl` — this was the path most responsible for "different kid on page 6," since it's the one that re-renders a close-up face with zero consistency anchor. Fixed: it now passes `styleReferenceUrl: sceneImageUrl` (that page's own scene illustration).

**2. `apps/api/src/generation/generation.service.ts` — `enrichSpeechBubbleLayout()`.**
Added a confidence gate: if the vision model's placement `confidence < 0.35`, the low-confidence `anchorPoint`/`bubbleRect` guess is dropped instead of used, so the frontend's existing position-based heuristic fallback (`inferComicPlacement` in `apps/web/src/app/stories/[id]/page.tsx`) kicks in instead of a bad estimate.

**3. `apps/api/src/ai/providers/openai-image.provider.ts` — `locateSpeechBubbleAnchors()` and `checkFaceConsistency()`.**
Bumped the GPT-4o-mini vision call `detail` from `'low'` to `'high'` in both — low resolution was too coarse to reliably locate a mouth position or judge face-identity drift. Cost delta is negligible next to per-page image-generation cost.

**4. `apps/api/src/ai/providers/openai-image.provider.ts` — prompt text.**
- The `styleRefLine` (cross-scene visual-consistency instruction) now explicitly names `style-ref.png` and states it wins on conflict with the scene description.
- The DB-template prompt path (the one actually active — check `prompt_template_versions` table, key `image_generation`) was missing a conflict-resolution sentence that only existed in the hardcoded fallback prompt. Added: `"If the scene description conflicts with the reference images or identity descriptions on any appearance detail, ignore the conflicting detail and follow the identity descriptions/reference images instead."`

**5. Reverted / privacy fix — raw photos are never persisted, anywhere.**
An earlier draft of this session's work added a `hero.originalPhotoUrl` DB column and threaded the raw uploaded photo through as a stronger face-identity reference (ref image #1, ahead of the avatar). **This was reverted** — the app's own upload UI tells parents "🔒 Photo is never saved — only the illustrated avatar is kept," and persisting the raw photo would break that promise. All `heroOriginalPhotoUrl`/`originalPhotoUrl` code paths were removed; `hero.entity.ts` and the `ImageGenerationInput` interface are back to their pre-session shape.

While reverting, a **pre-existing** violation of the same rule was found and fixed:
- `apps/api/src/heroes/heroes.service.ts` (`create`/`update`) was already calling `uploadService.uploadHeroPhoto()` on every photo upload, silently writing the raw photo to disk/R2 and discarding the returned URL. **Removed** — the photo buffer is now only used in-memory (`photo.buffer`) to call `generateAvatar()`/`describeCharacterAppearance()`.
- `apps/api/src/characters/characters.service.ts` (`create`/`update`/`refreshAvatar`, 3 call sites) was doing the same but actually **storing** the URL in `character.photoUrl`. Same fix applied — removed all three call sites. The `photoUrl` column on `Character` was left in the schema (harmless, always `null` going forward) rather than migrated away.
- `apps/api/src/upload/upload.service.ts` — deleted the now-dead `uploadHeroPhoto()` and `uploadCharacterPhoto()` methods (no longer called anywhere).

### Files touched (final diff, `git diff --stat` from `main`)
```
apps/api/src/ai/providers/openai-image.provider.ts |  17 ++-
apps/api/src/characters/characters.service.ts      |   6 +-
apps/api/src/generation/generation.service.ts      | 126 +++++++++++++--------
apps/api/src/heroes/heroes.service.ts               |   4 +-
apps/api/src/upload/upload.service.ts               |  30 -----
```
(`apps/api/src/heroes/hero.entity.ts` and `apps/api/src/ai/interfaces/image-generation.provider.ts` have **no net diff** — the photo-persistence addition was fully reverted from both.)

### What to verify in Codex

**1. Static checks**
```bash
cd apps/api
npx tsc --noEmit -p tsconfig.json
npx jest ai-quality-assurance --forceExit --no-coverage
npx jest --forceExit --no-coverage   # full suite, check for regressions
```

**2. Confirm no raw photo persistence (DB-level)**
```bash
cd apps/api
node -e "
const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  const cols = await c.query(\"select table_name, column_name from information_schema.columns where column_name ilike '%photo%'\");
  console.log(cols.rows);
  const stored = await c.query('select id, name, \"photoUrl\" from characters where \"photoUrl\" is not null');
  console.log('characters with a stored photoUrl (should be 0 going forward):', stored.rows.length);
  await c.end();
});
"
```
Expect: `heroes` table has no `originalPhotoUrl`/photo-related column; `characters.photoUrl` exists but is not being newly populated (any non-null rows predate this fix).

**3. End-to-end flow (manual or browser-driven)**
- Start both dev servers: `apps/api` (`npm run dev`, port 3000) and `apps/web` (`npm run dev`, picks 3001 if 3000 is taken).
- Log in at `/login` as parent: `vatharsh@gmail.com` / `admin@123`.
- Go to Cast & Characters, edit the main hero ("Siddhant Vats" in this test account), use "or generate from photo" to upload a photo and regenerate the avatar (uses 1 of the account's Avatar Refreshes).
  - Confirm the avatar regenerates normally.
  - Confirm **no new file** appears under `apps/api/uploads/avatars/photo-*` or `apps/api/uploads/heroes/` afterward, and the DB query above still shows nothing new.
- From the dashboard, generate a new story episode (costs 1 credit — check remaining credits first with `Buy More` if needed).
- Once generation completes, open the story reader (`/stories/[id]`) and check:
  - Page 1 vs. a mid-story page vs. any page that needed a page-specific expression regeneration (a page where a character is speaking) — hair, costume, and face should look like the same child/characters throughout.
  - Any page with a speech bubble — the bubble tail should point close to the speaker's mouth, not float over empty space or another character.
- Check API server logs for `Face QA` log lines (identity scores) and any `layoutConfidence`-related bubble drops, to confirm the new detail:'high' vision calls and confidence gate are active.

### Known constraints (do not change without asking)
- **Never persist a raw uploaded photo** (hero or supporting character) to disk, R2, or a DB column — only the AI-generated stylised avatar may be persisted. See `[[project_no_photo_storage]]` memory. Any future face-identity-fidelity work must use only the avatar/description, not a retained original photo.
- Production has TypeORM `synchronize` off and no migrations directory — schema changes need manual `ALTER TABLE` at deploy time. Not applicable here since this session's net schema diff is zero.

/**
 * migrate-uploads-to-r2.ts
 *
 * One-time idempotent migration: uploads files from the local Docker volume to R2
 * and updates DB URLs. Flags rows whose files are missing as needsRegeneration.
 *
 * Usage (from the repo root or apps/api):
 *   DRY RUN (default, safe):
 *     npx ts-node src/scripts/migrate-uploads-to-r2.ts
 *
 *   EXECUTE (writes to R2 + DB):
 *     npx ts-node src/scripts/migrate-uploads-to-r2.ts --execute
 *
 * Required env vars (same as .env / .env.production):
 *   DATABASE_URL, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME (default: heroverse-assets), R2_PUBLIC_URL
 *
 * Optional:
 *   UPLOADS_DIR  – absolute path to the uploads volume (default: /app/uploads when
 *                  run inside the container, or <cwd>/uploads when run locally)
 *   LOG_FILE     – path for the JSONL migration log (default: migration-r2.jsonl)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

// Load env from the nearest .env* file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.production') });

import { Pool } from 'pg';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// ── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--execute');
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads');
const LOG_FILE = process.env.LOG_FILE ?? path.resolve(process.cwd(), 'migration-r2.jsonl');

const R2_ACCOUNT_ID   = requireEnv('R2_ACCOUNT_ID');
const R2_ACCESS_KEY   = requireEnv('R2_ACCESS_KEY_ID');
const R2_SECRET_KEY   = requireEnv('R2_SECRET_ACCESS_KEY');
const R2_BUCKET       = process.env.R2_BUCKET_NAME ?? 'heroverse-assets';
const R2_PUBLIC_URL   = requireEnv('R2_PUBLIC_URL').replace(/\/$/, '');
const DATABASE_URL    = requireEnv('DATABASE_URL');

// Legacy API base for recognising local URLs
const LEGACY_API_BASES = [
  'https://api.herokidsuniverse.com/api/upload/files',
  'http://api.herokidsuniverse.com/api/upload/files',
  '/api/upload/files',
];

// ── Counters ─────────────────────────────────────────────────────────────────

const counts = {
  total: 0,
  alreadyMigrated: 0,
  migrated: 0,
  missing: 0,
  failed: 0,
  skipped: 0,
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function log(entry: object) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

// ── URL helpers ──────────────────────────────────────────────────────────────

function isR2Url(url: string): boolean {
  return url.startsWith(R2_PUBLIC_URL);
}

function isLegacyLocalUrl(url: string): boolean {
  return LEGACY_API_BASES.some((base) => url.startsWith(base) || url.includes('/upload/files/'));
}

/**
 * Maps a legacy local URL to the physical file path inside the uploads volume.
 *
 * URL routing (from upload.controller.ts):
 *   /upload/files/{filename}           → uploads/avatars/{filename}
 *   /upload/files/stories/{filename}   → uploads/stories/{filename}
 *   /upload/files/characters/{filename}→ uploads/characters/{filename}
 *   /upload/files/audio/{filename}     → uploads/audio/{filename}
 *   /upload/files/videos/{filename}    → uploads/videos/{filename}
 */
function localUrlToFilePath(url: string): string | null {
  // Strip the base prefix to get the path segment after /upload/files/
  let segment: string | null = null;
  for (const base of LEGACY_API_BASES) {
    const idx = url.indexOf('/upload/files/');
    if (idx !== -1) {
      segment = url.slice(idx + '/upload/files/'.length);
      break;
    }
  }
  if (!segment) return null;
  // Strip query string if any
  segment = segment.split('?')[0];

  // Route to disk directory
  if (segment.startsWith('stories/')) {
    return path.join(UPLOADS_DIR, 'stories', segment.slice('stories/'.length));
  }
  if (segment.startsWith('characters/')) {
    return path.join(UPLOADS_DIR, 'characters', segment.slice('characters/'.length));
  }
  if (segment.startsWith('audio/')) {
    return path.join(UPLOADS_DIR, 'audio', segment.slice('audio/'.length));
  }
  if (segment.startsWith('videos/')) {
    return path.join(UPLOADS_DIR, 'videos', segment.slice('videos/'.length));
  }
  // Default: avatar uploaded via /upload/files/{filename}
  return path.join(UPLOADS_DIR, 'avatars', segment);
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}

// ── R2 ───────────────────────────────────────────────────────────────────────

const s3 = new S3Client({
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function r2ObjectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ── Migration helper ─────────────────────────────────────────────────────────

/** Returned by migrateUrl when the local file is gone (a JSONB caller must clear it itself). */
const MISSING = Symbol('missing');

async function migrateUrl(
  pool: Pool,
  table: string,
  idCol: string,
  urlCol: string,
  rowId: string,
  oldUrl: string,
  keyPrefix: string,
  opts: { jsonbField?: boolean } = {},
): Promise<string | null | typeof MISSING> {
  counts.total++;

  if (!oldUrl) { counts.skipped++; return null; }
  if (isR2Url(oldUrl)) { counts.alreadyMigrated++; return null; }
  if (!isLegacyLocalUrl(oldUrl)) { counts.skipped++; return null; }

  const filePath = localUrlToFilePath(oldUrl);
  if (!filePath || !fs.existsSync(filePath)) {
    console.log(`  ✗ MISSING  [${table}.${urlCol}] ${rowId} → ${oldUrl}`);
    counts.missing++;
    if (!DRY_RUN) {
      // JSONB page fields can't be nulled by column name — the caller rewrites the pages array.
      if (!opts.jsonbField) {
        await pool.query(
          `UPDATE ${table} SET "${urlCol}" = NULL, "needsRegeneration" = true WHERE "${idCol}" = $1`,
          [rowId],
        );
      }
      log({ type: 'missing', table, urlCol, rowId, oldUrl });
    }
    return MISSING;
  }

  const ext = path.extname(filePath);
  const key = `${keyPrefix}/${randomUUID()}${ext}`;
  const newUrl = `${R2_PUBLIC_URL}/${key}`;

  console.log(`  ↑ MIGRATE  [${table}.${urlCol}] ${rowId}`);
  console.log(`              ${oldUrl}`);
  console.log(`           → ${newUrl}`);

  if (DRY_RUN) {
    counts.migrated++;
    return newUrl;
  }

  try {
    const buffer = fs.readFileSync(filePath);
    await uploadToR2(key, buffer, guessContentType(filePath));
    // HEAD verify
    if (!(await r2ObjectExists(key))) throw new Error('HEAD check failed after upload');
    await pool.query(
      `UPDATE ${table} SET "${urlCol}" = $1 WHERE "${idCol}" = $2`,
      [newUrl, rowId],
    );
    log({ type: 'migrated', table, urlCol, rowId, oldUrl, newUrl, key });
    counts.migrated++;
    return newUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ FAILED   [${table}.${urlCol}] ${rowId}: ${msg}`);
    log({ type: 'failed', table, urlCol, rowId, oldUrl, error: msg });
    counts.failed++;
    return null;
  }
}

// ── Table migrations ─────────────────────────────────────────────────────────

async function migrateHeroes(pool: Pool) {
  console.log('\n── Heroes ──────────────────────────────────────────────');
  const { rows } = await pool.query<{ id: string; avatarUrl: string | null }>(
    `SELECT id, "avatarUrl" FROM heroes WHERE "avatarUrl" IS NOT NULL`,
  );
  for (const row of rows) {
    if (!row.avatarUrl) continue;
    await migrateUrl(pool, 'heroes', 'id', 'avatarUrl', row.id, row.avatarUrl, `avatars/heroes/${row.id}`);
  }
}

async function migrateCharacters(pool: Pool) {
  console.log('\n── Characters ───────────────────────────────────────────');
  const { rows } = await pool.query<{ id: string; avatarUrl: string | null }>(
    `SELECT id, "avatarUrl" FROM characters WHERE "avatarUrl" IS NOT NULL`,
  );
  for (const row of rows) {
    if (!row.avatarUrl) continue;
    await migrateUrl(pool, 'characters', 'id', 'avatarUrl', row.id, row.avatarUrl, `avatars/characters/${row.id}`);
  }
}

async function migrateStories(pool: Pool) {
  console.log('\n── Stories (cover + pdf + video) ────────────────────────');
  const { rows } = await pool.query<{ id: string; coverImageUrl: string | null; pdfUrl: string | null; videoUrl: string | null }>(
    `SELECT id, "coverImageUrl", "pdfUrl", "videoUrl" FROM stories`,
  );
  for (const row of rows) {
    if (row.coverImageUrl) {
      await migrateUrl(pool, 'stories', 'id', 'coverImageUrl', row.id, row.coverImageUrl, `stories/${row.id}/cover`);
    }
    if (row.pdfUrl) {
      await migrateUrl(pool, 'stories', 'id', 'pdfUrl', row.id, row.pdfUrl, `stories/${row.id}/pdf`);
    }
    if (row.videoUrl) {
      await migrateUrl(pool, 'stories', 'id', 'videoUrl', row.id, row.videoUrl, `stories/${row.id}/video`);
    }
  }
}

async function migrateStoryPages(pool: Pool) {
  console.log('\n── Story pages (JSONB) ───────────────────────────────────');
  const { rows } = await pool.query<{ id: string; pages: any[] }>(
    `SELECT id, pages FROM stories WHERE pages IS NOT NULL AND jsonb_array_length(pages) > 0`,
  );

  for (const story of rows) {
    let pagesModified = false;
    let storyHasMissing = false;
    const updatedPages = [...story.pages];

    for (let i = 0; i < updatedPages.length; i++) {
      const page = { ...updatedPages[i] };
      const pageNum = page.pageNumber ?? i + 1;

      if (page.imageUrl && isLegacyLocalUrl(page.imageUrl)) {
        const newUrl = await migrateUrl(
          pool, 'stories', 'id', `pages[${i}].imageUrl`, story.id,
          page.imageUrl, `stories/${story.id}/pages/${pageNum}`, { jsonbField: true },
        );
        if (newUrl === MISSING) { page.imageUrl = null; pagesModified = true; storyHasMissing = true; }
        else if (newUrl) { page.imageUrl = newUrl; pagesModified = true; }
      } else if (page.imageUrl) {
        counts.total++; counts.alreadyMigrated++;
      }

      if (page.backgroundUrl && isLegacyLocalUrl(page.backgroundUrl)) {
        const newUrl = await migrateUrl(
          pool, 'stories', 'id', `pages[${i}].backgroundUrl`, story.id,
          page.backgroundUrl, `stories/${story.id}/pages/${pageNum}-bg`, { jsonbField: true },
        );
        if (newUrl === MISSING) { page.backgroundUrl = null; pagesModified = true; storyHasMissing = true; }
        else if (newUrl) { page.backgroundUrl = newUrl; pagesModified = true; }
      }

      if (page.audioUrl && isLegacyLocalUrl(page.audioUrl)) {
        const newUrl = await migrateUrl(
          pool, 'stories', 'id', `pages[${i}].audioUrl`, story.id,
          page.audioUrl, `stories/${story.id}/audio/${pageNum}`, { jsonbField: true },
        );
        if (newUrl === MISSING) { page.audioUrl = null; pagesModified = true; storyHasMissing = true; }
        else if (newUrl) { page.audioUrl = newUrl; pagesModified = true; }
      }

      updatedPages[i] = page;
    }

    // Write updated JSONB back in one shot per story (not per URL)
    if (!DRY_RUN && pagesModified) {
      await pool.query(
        `UPDATE stories SET pages = $1::jsonb, "needsRegeneration" = (COALESCE("needsRegeneration", false) OR $3) WHERE id = $2`,
        [JSON.stringify(updatedPages), story.id, storyHasMissing],
      );
    }
  }
}

async function addNeedsRegenerationColumns(pool: Pool) {
  for (const table of ['heroes', 'characters', 'stories']) {
    try {
      await pool.query(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "needsRegeneration" boolean DEFAULT NULL`,
      );
      console.log(`  ✓ ensured "needsRegeneration" column on ${table}`);
    } catch (err) {
      console.warn(`  ! could not add column to ${table}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('HeroKidsUniverse — R2 Upload Migration');
  console.log(`Mode:    ${DRY_RUN ? 'DRY RUN (pass --execute to write)' : 'EXECUTE'}`);
  console.log(`Bucket:  ${R2_BUCKET}`);
  console.log(`CDN:     ${R2_PUBLIC_URL}`);
  console.log(`Uploads: ${UPLOADS_DIR}`);
  console.log(`Log:     ${LOG_FILE}`);
  console.log('='.repeat(60));

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    await pool.query('SELECT 1'); // connection check
    console.log('✓ DB connected');

    if (!DRY_RUN) {
      await addNeedsRegenerationColumns(pool);
    }

    await migrateHeroes(pool);
    await migrateCharacters(pool);
    await migrateStories(pool);
    await migrateStoryPages(pool);

    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`  Total URLs examined : ${counts.total}`);
    console.log(`  Already on R2       : ${counts.alreadyMigrated}`);
    console.log(`  Migrated            : ${counts.migrated}${DRY_RUN ? ' (dry-run, not written)' : ''}`);
    console.log(`  Missing on disk     : ${counts.missing}${DRY_RUN ? ' (dry-run, not nulled)' : ' → nulled + needsRegeneration=true'}`);
    console.log(`  Failed              : ${counts.failed}`);
    console.log(`  Skipped             : ${counts.skipped}`);
    if (!DRY_RUN) console.log(`\n  Log written to: ${LOG_FILE}`);
    console.log('');

    if (DRY_RUN) {
      console.log('Run with --execute to apply the migration.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

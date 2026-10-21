/**
 * One-off: make small WebP previews for story pictures created before previews existed.
 * Safe to re-run — pictures that already have a preview are skipped.
 *
 *   prod:  docker exec herokids-hku-api-1 node dist/scripts/backfill-image-previews.js
 *   local: cd apps/api && npx ts-node -r dotenv/config src/scripts/backfill-image-previews.ts
 */
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { UploadService } from '../upload/upload.service';

interface Row { coverImageUrl: string | null; pages: Array<{ imageUrl?: string; backgroundUrl?: string }> | null }

async function main() {
  const db = await new DataSource({ type: 'postgres', url: process.env.DATABASE_URL }).initialize();
  const rows: Row[] = await db.query(`SELECT "coverImageUrl", pages FROM stories WHERE status = 'completed'`);
  await db.destroy();

  const urls = new Set<string>();
  for (const row of rows) {
    if (row.coverImageUrl) urls.add(row.coverImageUrl);
    for (const page of row.pages ?? []) {
      if (page.imageUrl) urls.add(page.imageUrl);
      if (page.backgroundUrl) urls.add(page.backgroundUrl);
    }
  }

  const upload = new UploadService(new ConfigService(process.env));
  const counts = { created: 0, exists: 0, skipped: 0, failed: 0 };
  const queue = [...urls];
  console.log(`${rows.length} stories, ${queue.length} pictures to check`);

  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        counts[await upload.ensurePreview(url)] += 1;
      } catch (err) {
        counts.failed += 1;
        console.warn(`failed ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
      const done = counts.created + counts.exists + counts.skipped + counts.failed;
      if (done % 50 === 0) console.log(`${done}/${urls.size}`, counts);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log('done', counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

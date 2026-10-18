# Cloudflare R2 Setup & Operations Runbook

> **Platform:** HeroKidsUniverse — `root@23.88.97.92` (single VPS, Docker Compose)
> **Bucket:** `heroverse-assets`
> **CDN domain:** `assets.herokidsuniverse.com`

---

## 1. Activate R2 (new uploads immediately go to R2)

Add these to `/opt/herokids/.env.production` on the server:

```env
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=heroverse-assets
R2_PUBLIC_URL=https://assets.herokidsuniverse.com
```

Then restart only the API container (do NOT use `down -v` — that wipes the old volume):

```bash
cd /opt/herokids
docker compose -f docker-compose.prod.yml pull hku-api
docker compose -f docker-compose.prod.yml up -d --no-deps hku-api
```

**Verification:** Generate a test avatar in the app, then confirm the returned URL starts with `https://assets.herokidsuniverse.com/`.

The API logs a prominent warning at boot if `R2_*` env vars are missing in production. Check logs with:

```bash
docker compose -f docker-compose.prod.yml logs hku-api | grep -i "r2"
```

---

## 2. Create the R2 bucket

In the Cloudflare dashboard → R2 → Create bucket:

- **Name:** `heroverse-assets`
- **Location:** Automatic (nearest to users — India/Asia)
- **Default storage class:** Standard

Do **not** enable public bucket access. Public access is controlled exclusively through the custom domain binding (step 3).

---

## 3. Connect custom domain `assets.herokidsuniverse.com`

1. Cloudflare dashboard → R2 → `heroverse-assets` → **Settings** → **Custom Domains**
2. Add domain: `assets.herokidsuniverse.com`
3. Cloudflare automatically creates the DNS CNAME and issues an SSL certificate.
4. Wait ~60 seconds for propagation.

> **Never use the `pub-xxx.r2.dev` URL in any stored DB value.** It is rate-limited, not production-grade, and will break if disabled. All code uses `R2_PUBLIC_URL` which points to the custom domain.

---

## 4. Cloudflare cache rule (serve from edge cache)

In Cloudflare dashboard → **Rules** → **Cache Rules** → Create rule:

| Field | Value |
|---|---|
| Rule name | R2 assets — cache everything |
| When | Hostname equals `assets.herokidsuniverse.com` |
| Cache eligibility | **Eligible for cache** |
| Cache behaviour | **Cache everything** |
| Edge TTL | Respect origin (API sets `Cache-Control: public, max-age=31536000, immutable`) |

This means every object is fetched from R2 at most once per PoP, then served from Cloudflare's edge globally.

---

## 5. X-Robots-Tag: noindex for avatar paths (privacy — children's platform)

Avatar images are derived from real children's photos. They must not be indexed by image search engines.

In Cloudflare dashboard → **Rules** → **Transform Rules** → **Response Header Modification** → Create rule:

| Field | Value |
|---|---|
| Rule name | noindex avatars |
| When | Hostname = `assets.herokidsuniverse.com` AND URI path matches `^/avatars/` |
| Modify response header | **Add** `X-Robots-Tag: noindex` |

**Verify:**

```bash
curl -sI https://assets.herokidsuniverse.com/avatars/heroes/<any-key>.png | grep -i x-robots
# Expected: X-Robots-Tag: noindex
```

---

## 6. CORS decision

**No R2 CORS policy is required.**

All image `<img>` tags in the web app use simple HTML src attributes. No JavaScript `fetch()`, `canvas.drawImage` cross-origin, or `XMLHttpRequest` reads image data from R2. Canvas usage in `AvatarGenerateModal` operates on locally loaded data URLs (user's own camera/file upload), not on R2-hosted images.

If future features require cross-origin image access (e.g. client-side PDF generation that reads pixel data from R2 images), add a CORS policy at that point:

```json
[{
  "AllowedOrigins": [
    "https://herokidsuniverse.com",
    "https://www.herokidsuniverse.com"
  ],
  "AllowedMethods": ["GET", "HEAD"],
  "MaxAgeSeconds": 86400
}]
```

---

## 7. Migrate existing volume files to R2 (Task 3)

Run this **after** step 1 activates R2 (env vars set and container restarted).

### On the server, inside the API container:

```bash
# 1. Enter the running container
docker compose -f docker-compose.prod.yml exec hku-api sh

# 2. Dry run first — prints counts, writes nothing
npx ts-node src/scripts/migrate-uploads-to-r2.ts

# 3. Review the output. When ready:
npx ts-node src/scripts/migrate-uploads-to-r2.ts --execute

# 4. The log is written to migration-r2.jsonl in the container's working dir
#    Copy it out if needed:
exit
docker compose -f docker-compose.prod.yml cp hku-api:/app/migration-r2.jsonl ./migration-r2.jsonl
```

### What the script does:
| URL state | Action |
|---|---|
| Already on `assets.herokidsuniverse.com` | Skip (idempotent) |
| Legacy `/api/upload/files/...` AND file exists on disk | Upload to R2 → update DB → log |
| Legacy URL AND file **missing** from disk | NULL the URL + set `needsRegeneration=true` → log |

Rows with `needsRegeneration=true` are visible in the admin panel. Users can re-generate their avatars from Cast → Edit.

---

## 8. Deletion lifecycle

Story/hero/character deletion automatically removes R2 objects via the app code:

- **Story delete:** All page `imageUrl`, `audioUrl`, `backgroundUrl`, `coverImageUrl`, `pdfUrl`, `videoUrl`
- **Hero delete:** `avatarUrl`
- **Character delete:** `avatarUrl`
- **Avatar regeneration:** Old R2 object deleted after the DB row is updated with the new URL.

Deletion is fire-and-forget on error (logged as WARNING) — it never blocks the DB operation.

---

## 9. Bucket access controls

- Bucket is **not** publicly listable: Cloudflare R2 does not expose `s3:ListBucket` through the public domain binding.
- Access key in `.env.production` should have **Object Read & Write** scope on `heroverse-assets` only — not account-level access.

To create a scoped key:
1. Cloudflare dashboard → R2 → **Manage R2 API Tokens**
2. Create token: permissions `Object Read & Write`, scope to bucket `heroverse-assets`

---

## 10. Backup (Task 8)

See [`scripts/r2-backup.sh`](../scripts/r2-backup.sh). The script uses `rclone` to sync `heroverse-assets` to a second bucket daily.

**Restore a single object:**

```bash
# Pull one object from backup bucket to local, then re-upload to R2
rclone copy backup-r2:heroverse-assets-backup/avatars/heroes/<uuid>/<file>.png /tmp/restore/
# Then upload via rclone or the AWS CLI:
aws s3 cp /tmp/restore/<file>.png s3://heroverse-assets/avatars/heroes/<uuid>/<file>.png \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
  --content-type image/png \
  --cache-control "public, max-age=31536000, immutable"
```

**Restore a full story's assets:**

```bash
rclone copy backup-r2:heroverse-assets-backup/stories/<story-uuid>/ /tmp/restore/story/
# Re-upload each file, then update DB URLs manually or via the migration script
```

**Full bucket restore (disaster recovery):**

```bash
rclone sync backup-r2:heroverse-assets-backup/ primary-r2:heroverse-assets/
```

---

## Checklist for go-live

- [ ] R2 bucket `heroverse-assets` created
- [ ] Custom domain `assets.herokidsuniverse.com` connected in R2 settings
- [ ] DNS CNAME propagated (`dig assets.herokidsuniverse.com` returns Cloudflare)
- [ ] Cache rule created for `assets.herokidsuniverse.com/*`
- [ ] `X-Robots-Tag: noindex` Transform Rule in place; verified with `curl -I`
- [ ] `.env.production` updated with R2 credentials
- [ ] API container restarted; boot logs show no R2 warning
- [ ] Test image uploaded; URL starts with `https://assets.herokidsuniverse.com/`
- [ ] Migration script dry-run reviewed
- [ ] Migration script executed; log reviewed
- [ ] Backup job scheduled and tested (`scripts/r2-backup.sh`)
- [ ] Rclone remote `primary-r2` and `backup-r2` configured on server

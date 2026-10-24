-- Free-preview waiting list (FREE_PREVIEW_DAILY_LIMIT). Prod has no schema sync. Safe to re-run.
CREATE TABLE IF NOT EXISTS preview_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "notifiedAt" timestamp NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_preview_waitlist_userId" ON preview_waitlist ("userId");

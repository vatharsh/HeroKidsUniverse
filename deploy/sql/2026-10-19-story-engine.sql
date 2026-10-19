-- Story engine: recurring villains, physical gear, closed quests.
-- Prod has no schema sync — run this before redeploying. Safe to run more than once.

BEGIN;

-- Gear: powers can now be physical artifacts with a fixed look.
ALTER TABLE hero_powers ADD COLUMN IF NOT EXISTS "kind" varchar(20) NOT NULL DEFAULT 'power';
ALTER TABLE hero_powers ADD COLUMN IF NOT EXISTS "look" text;

-- Villains the hero has met, per universe, so escaped villains can come back looking the same.
CREATE TABLE IF NOT EXISTS universe_villains (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "universeId" uuid NOT NULL REFERENCES universes("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "look" text,
  "scheme" text,
  "status" varchar(20) NOT NULL DEFAULT 'defeated',
  "appearances" int NOT NULL DEFAULT 1,
  "firstStoryId" uuid,
  "lastStoryId" uuid,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_universe_villains_universe_name" ON universe_villains ("universeId", "name");

-- Backfill: every villain already recorded as a "villain_defeated" memory.
INSERT INTO universe_villains ("universeId", "name", "status", "appearances", "firstStoryId", "lastStoryId", "createdAt", "updatedAt")
SELECT m."universeId", m."title", 'defeated', 1, m."storyId", m."storyId", m."createdAt", m."createdAt"
FROM universe_memories m
WHERE m."type" = 'villain_defeated'
  AND NOT EXISTS (
    SELECT 1 FROM universe_villains v WHERE v."universeId" = m."universeId" AND lower(v."name") = lower(m."title")
  );

-- Backfill: close quests that a later episode already completed (they were never closed before).
UPDATE quests q
SET "status" = 'completed', "completedInStoryId" = m."storyId"
FROM universe_memories m
WHERE q."status" = 'open'
  AND m."universeId" = q."universeId"
  AND m."type" = 'quest_completed'
  AND lower(trim(trailing '.' from m."title")) = lower(trim(trailing '.' from q."title"));

COMMIT;

-- Duplicate open quests (the writer re-opened quests that were already open): keep the newest copy.
UPDATE quests SET "status" = 'completed'
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (
      PARTITION BY "universeId", lower(trim(trailing '.' from trim("title"))) ORDER BY "createdAt" DESC
    ) AS rn
    FROM quests WHERE "status" = 'open'
  ) dupes
  WHERE rn > 1
);

-- Close every open quest except the 3 newest per universe (stories only use the newest 3;
-- the old ones were mostly duplicates). Closed ones have no completing story.
UPDATE quests SET "status" = 'completed'
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (PARTITION BY "universeId" ORDER BY "createdAt" DESC) AS rn
    FROM quests WHERE "status" = 'open'
  ) ranked
  WHERE rn > 3
);

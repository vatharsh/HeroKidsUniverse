-- Hidden Powers: a special power hidden in every story on chosen days; heroes find it with the magic lens.
ALTER TYPE credit_transactions_reason_enum ADD VALUE IF NOT EXISTS 'reward';
CREATE TABLE IF NOT EXISTS power_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  name text NOT NULL,
  emoji text NOT NULL,
  description text NOT NULL,
  "isDeleted" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS power_drops_day ON power_drops (day);
CREATE TABLE IF NOT EXISTS power_finds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dropId" uuid NOT NULL,
  "heroId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "storyId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS power_finds_drop_hero ON power_finds ("dropId", "heroId");
CREATE INDEX IF NOT EXISTS power_finds_hero ON power_finds ("heroId");

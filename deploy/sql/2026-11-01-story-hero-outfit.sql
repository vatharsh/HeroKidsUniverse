-- A new look for the hero in one story (and, inside a universe, the episodes after it).
-- '' means "back to the usual outfit". The universe's saved look lives in universes."visualState".heroOutfit (jsonb).
ALTER TABLE stories ADD COLUMN IF NOT EXISTS "heroOutfit" text;

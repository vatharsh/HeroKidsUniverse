-- "Plays as…": the part each cast member plays in one story, by character id ({"<id>": "the Genie"}).
ALTER TABLE stories ADD COLUMN IF NOT EXISTS "castRoles" jsonb;

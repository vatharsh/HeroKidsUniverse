-- Soft delete for accounts (users."deletedAt"). Run BEFORE deploying the code that reads it,
-- or every user lookup fails. Prod has no schema sync. Safe to run more than once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP NULL;

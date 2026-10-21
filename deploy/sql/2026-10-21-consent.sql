-- Parental consent recorded at sign-up (Terms/Privacy version accepted). Prod has no schema sync.
ALTER TABLE users ADD COLUMN IF NOT EXISTS "termsAcceptedAt" timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "termsVersion" varchar(20);

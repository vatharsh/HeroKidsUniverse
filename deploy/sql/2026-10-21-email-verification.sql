-- Email verification codes (sign-up + password reset). Prod has no schema sync.
ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerifiedAt" timestamp;

CREATE TABLE IF NOT EXISTS email_codes (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "purpose" varchar(30) NOT NULL,
  "codeHash" varchar(64) NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "attempts" int NOT NULL DEFAULT 0,
  "consumedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_email_codes_user_purpose" ON email_codes ("userId", "purpose");

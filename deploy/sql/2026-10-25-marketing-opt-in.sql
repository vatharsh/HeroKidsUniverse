-- Marketing emails are opt-in: new rows default to off, and nobody has knowingly opted in yet
-- (no promotional emails have ever been sent), so reset everyone to off.
BEGIN;
ALTER TABLE user_notification_preferences ALTER COLUMN "promotionalEmails" SET DEFAULT false;
UPDATE user_notification_preferences SET "promotionalEmails" = false, "specialOffers" = false
 WHERE "promotionalEmails" = true OR "specialOffers" = true;
COMMIT;

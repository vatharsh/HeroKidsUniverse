-- Test accounts (admin → Users → "Test account") and removal of the unused image-cap settings.
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isTestAccount" boolean NOT NULL DEFAULT false;
DELETE FROM platform_settings WHERE key IN ('MAX_IMAGES_PER_STORY_DEV', 'MAX_IMAGES_PER_STORY_PROD');

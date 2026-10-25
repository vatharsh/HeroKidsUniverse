-- Settings clean-up: merge plan pages into FULL_STORY_PAGES, drop settings no code reads,
-- raise the daily AI limit for launch (it now refunds and emails instead of stalling stories).
BEGIN;

INSERT INTO platform_settings (key, value, type, description, "updatedAt")
SELECT 'FULL_STORY_PAGES', value, 'number', 'Pages in a full (paid) story, including the cover', now()
  FROM platform_settings WHERE key = 'BASIC_PLAN_PAGES'
ON CONFLICT (key) DO NOTHING;

-- The face-match threshold now has one setting (QA_MIN_IDENTITY_SCORE); keep the stricter of the two.
UPDATE platform_settings q SET value = f.value, "updatedAt" = now()
  FROM platform_settings f
 WHERE q.key = 'QA_MIN_IDENTITY_SCORE' AND f.key = 'FACE_CONSISTENCY_THRESHOLD'
   AND f.value ~ '^[0-9.]+$' AND q.value ~ '^[0-9.]+$' AND f.value::numeric > q.value::numeric;

DELETE FROM platform_settings WHERE key IN (
  'BASIC_PLAN_PAGES', 'STANDARD_PLAN_PAGES', 'PREMIUM_PLAN_PAGES', 'FACE_CONSISTENCY_THRESHOLD',
  'ENABLE_STORY_CONTINUATION', 'ENABLE_UNIVERSE_MEMORY',
  'QA_DISABLE_CHARACTER_CANON', 'QA_DISABLE_STORY_STATE', 'QA_DISABLE_CONFIDENCE_ENGINE', 'QA_DISABLE_SPEECH_BUBBLES',
  'QA_MODE', 'QA_MAX_COST_PER_AVATAR', 'QA_MAX_COST_PER_PAGE', 'QA_PROMPT_VERSION_OVERRIDE', 'QA_MODEL_OVERRIDE',
  'QA_DAILY_BUDGET_ALERT', 'QA_MONTHLY_BUDGET_ALERT', 'QA_NOTIFY_ADMIN_ON_BUDGET',
  'QA_LAST_MODIFIED_BY', 'QA_LAST_MODIFIED_ON', 'QA_SETTINGS_VERSION'
);

UPDATE platform_settings SET value = '60', "updatedAt" = now()
 WHERE key = 'AI_DAILY_COST_HARD_LIMIT_USD' AND value = '25';

COMMIT;

-- New AI usage types so safety reviews, speech-bubble detection, quality checks and appearance
-- analysis show up in AI Analytics. Prod has no schema sync. Safe to run more than once.
ALTER TYPE ai_usage_logs_operation_enum ADD VALUE IF NOT EXISTS 'safety_check';
ALTER TYPE ai_usage_logs_operation_enum ADD VALUE IF NOT EXISTS 'speech_bubble_detection';
ALTER TYPE ai_usage_logs_operation_enum ADD VALUE IF NOT EXISTS 'quality_check';
ALTER TYPE ai_usage_logs_operation_enum ADD VALUE IF NOT EXISTS 'appearance_analysis';

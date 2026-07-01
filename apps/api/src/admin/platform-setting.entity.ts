import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'text', default: 'string' })
  type!: PlatformSettingType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export type PlatformSettingType = 'string' | 'number' | 'boolean';

export interface PlatformSettingDefinition {
  value: string;
  type: PlatformSettingType;
  description: string;
}

/**
 * Keys safe to return on the unauthenticated /platform-settings endpoint.
 * Only add a key here if a user-facing (non-admin) frontend page needs it to
 * show or hide a UI element. AI pricing, cost limits, QA config, TTS config,
 * and internal pipeline flags must NOT appear here.
 */
export const PUBLIC_SETTING_KEYS = [
  'ENABLE_MERCHANDISE',
  'ENABLE_PHYSICAL_ORDERS',
  'ENABLE_VIDEO_EXPORT',
  'ENABLE_INFLUENCER_PROGRAM',
] as const;

export const SETTING_DEFAULTS: Record<string, PlatformSettingDefinition> = {
  AI_DAILY_COST_WARNING_USD:      { value: '10',  type: 'number',  description: 'Alert threshold for daily AI spend (USD)' },
  AI_MONTHLY_COST_WARNING_USD:    { value: '200', type: 'number',  description: 'Alert threshold for monthly AI spend (USD)' },
  AI_DAILY_COST_HARD_LIMIT_USD:   { value: '25',  type: 'number',  description: 'Hard stop threshold for daily AI spend (USD)' },
  AI_MONTHLY_COST_HARD_LIMIT_USD:  { value: '500', type: 'number',  description: 'Hard stop threshold for monthly AI spend (USD)' },
  BASIC_PLAN_PAGES:               { value: '6',   type: 'number',  description: 'Default number of pages for the Basic plan' },
  DISPLAY_CURRENCY:               { value: 'INR', type: 'string',  description: 'Primary currency shown in admin dashboards' },
  ENABLE_INDIAN_ENGLISH_NARRATION:{ value: 'true', type: 'boolean', description: 'Enable Indian English narration prompts and voices' },
  ENABLE_INFLUENCER_PROGRAM:      { value: 'false', type: 'boolean', description: 'Show influencer program admin tools' },
  CHARACTER_CANON_ENABLED:        { value: 'true', type: 'boolean', description: 'Use Character Canon system for face consistency in image generation. Falls back to avatarDescription if disabled or canon missing.' },
  CHARACTER_CANON_MIN_QUALITY:    { value: '70',   type: 'number',  description: 'Minimum canon quality score to use for generation. Below this threshold, canon is marked needs_review but still used.' },
  FACE_CONSISTENCY_QA_ENABLED:    { value: 'true', type: 'boolean', description: 'Run a vision-based face identity check after each story illustration; low-scoring images are regenerated once' },
  FACE_CONSISTENCY_THRESHOLD:     { value: '7',    type: 'number',  description: 'Minimum identity score (1–10) before accepting an illustration without regeneration' },
  SANDBOX_MODE:                   { value: 'true',  type: 'boolean', description: 'All new orders are stamped as sandbox (test) orders. Toggle to switch to live mode.' },
  ENABLE_MERCHANDISE:             { value: 'false', type: 'boolean', description: 'Show merchandise-related product surfaces' },
  ENABLE_NARRATION:               { value: 'true', type: 'boolean', description: 'Enable narration generation' },
  ENABLE_PHYSICAL_ORDERS:         { value: 'false', type: 'boolean', description: 'Show physical order options' },
  ENABLE_SCENE_GENERATION:        { value: 'true', type: 'boolean', description: 'Use scene-based illustration grouping (Phase 2). Reduces AI image cost by 50-60%.' },
  ENABLE_STORY_CONTINUATION:      { value: 'true', type: 'boolean', description: 'Allow story continuation from existing arcs' },
  ENABLE_UNIVERSE_MEMORY:         { value: 'true', type: 'boolean', description: 'Persist and reuse universe memory' },
  ENABLE_VIDEO_EXPORT:            { value: 'true', type: 'boolean', description: 'Show video export controls for stories' },
  FREE_SIGNUP_CREDITS:            { value: '3',   type: 'number',  description: 'Credits awarded automatically on signup' },
  MAX_IMAGES_PER_STORY_DEV:       { value: '10',  type: 'number',  description: 'Maximum generated images per story in development' },
  MAX_IMAGES_PER_STORY_PROD:      { value: '10',  type: 'number',  description: 'Maximum generated images per story in production' },
  PREMIUM_PLAN_PAGES:             { value: '10',  type: 'number',  description: 'Default number of pages for the Premium plan' },
  STANDARD_PLAN_PAGES:            { value: '8',   type: 'number',  description: 'Default number of pages for the Standard plan' },
  USD_INR_RATE:                   { value: '86',  type: 'number',  description: 'USD to INR conversion rate used for dashboards and pricing' },
  // AI model pricing — update these whenever provider pricing changes
  GEMINI_INPUT_COST_PER_1M_TOKENS:  { value: '0.10',     type: 'number', description: 'Gemini input token cost per 1M tokens (USD). Default: Gemini 2.5 Flash Lite.' },
  GEMINI_OUTPUT_COST_PER_1M_TOKENS: { value: '0.40',     type: 'number', description: 'Gemini output token cost per 1M tokens (USD). Default: Gemini 2.5 Flash Lite.' },
  OPENAI_IMAGE_COST_PER_IMAGE:      { value: '0.011',    type: 'number', description: 'OpenAI image generation cost per image (USD). Default assumes gpt-image-1 low quality for story pages.' },
  OPENAI_TTS_COST_PER_CHAR:         { value: '0.000015', type: 'number', description: 'OpenAI TTS cost per character (USD). Default: gpt-4o-mini-tts at $15/1M chars.' },
  // TTS voice and narration
  TTS_VOICE:                        { value: 'nova',   type: 'string',  description: 'OpenAI TTS voice (nova, alloy, echo, fable, onyx, shimmer). Change without redeploy.' },
  TTS_SPEED_RATIO:                  { value: '0.9',    type: 'number',  description: 'TTS speech rate (0.25–4.0). 0.9 = slightly slower for children.' },
  TTS_ACCENT_STYLE:                 { value: 'indian_english', type: 'string', description: 'Narration accent hint passed to TTS instructions (indian_english, neutral_english).' },
  TTS_TONE:                         { value: 'warm_bedtime_story', type: 'string', description: 'Narration tone hint passed to TTS instructions.' },
  // AI Quality Assurance Engine (Milestone 3)
  QA_ENABLED:                       { value: 'true',  type: 'boolean', description: 'Master toggle for the AI Quality Assurance Engine.' },
  QA_ENABLE_AUTO_REGENERATION:      { value: 'true',  type: 'boolean', description: 'Automatically regenerate pages that fail identity QA.' },
  QA_ENABLE_IDENTITY_QA:            { value: 'true',  type: 'boolean', description: 'Enable identity QA (face resemblance check per page).' },
  QA_ENABLE_STORY_QA:               { value: 'true',  type: 'boolean', description: 'Enable story continuity QA (costume/companion/power consistency).' },
  QA_ENABLE_EXPRESSION_QA:          { value: 'true',  type: 'boolean', description: 'Enable expression QA (expression matches dialogue emotion).' },
  QA_ENABLE_DIALOGUE_QA:            { value: 'true',  type: 'boolean', description: 'Enable dialogue QA (speaker validity, no duplicates).' },
  QA_ENABLE_COMPOSITION_QA:         { value: 'false', type: 'boolean', description: 'Enable AI vision composition QA (costs one vision call per page — off by default).' },
  QA_ENABLE_NARRATION_QA:           { value: 'true',  type: 'boolean', description: 'Enable narration QA (audio presence + text length check).' },
  QA_MIN_IDENTITY_SCORE:            { value: '6',     type: 'number',  description: 'Minimum identity score (0–10) for a page to pass Identity QA.' },
  QA_MIN_STORY_SCORE:               { value: '6',     type: 'number',  description: 'Minimum story continuity score (0–10) for a page to pass Story QA.' },
  QA_MIN_EXPRESSION_SCORE:          { value: '5',     type: 'number',  description: 'Minimum expression score (0–10) for a page to pass Expression QA.' },
  QA_MIN_OVERALL_CONFIDENCE:        { value: '70',    type: 'number',  description: 'Minimum overall confidence (0–100) before auto-regeneration is triggered.' },
  QA_MAX_RETRIES:                   { value: '2',     type: 'number',  description: 'Maximum auto-regeneration attempts per failed page.' },
  QA_WEIGHT_IDENTITY:               { value: '40',    type: 'number',  description: 'Weight of Identity QA in the overall confidence score (%).' },
  QA_WEIGHT_STORY:                  { value: '20',    type: 'number',  description: 'Weight of Story QA in overall confidence (%).' },
  QA_WEIGHT_EXPRESSION:             { value: '10',    type: 'number',  description: 'Weight of Expression QA in overall confidence (%).' },
  QA_WEIGHT_DIALOGUE:               { value: '10',    type: 'number',  description: 'Weight of Dialogue QA in overall confidence (%).' },
  QA_WEIGHT_COMPOSITION:            { value: '10',    type: 'number',  description: 'Weight of Composition QA in overall confidence (%).' },
  QA_WEIGHT_NARRATION:              { value: '5',     type: 'number',  description: 'Weight of Narration QA in overall confidence (%).' },
  QA_WEIGHT_STATE_CONSISTENCY:      { value: '5',     type: 'number',  description: 'Weight of Story State Consistency in overall confidence (%).' },
  QA_STORY_PROMPT_VERSION:          { value: '1.0',         type: 'string',  description: 'Story prompt version tag — increment to track prompt improvements.' },
  QA_IMAGE_PROMPT_VERSION:          { value: '1.0',         type: 'string',  description: 'Image prompt version tag.' },
  QA_VERSION:                       { value: '1.0',         type: 'string',  description: 'QA engine version tag.' },

  // ── Preset & mode ─────────────────────────────────────────────────────────────
  QA_PRESET:                        { value: 'balanced',    type: 'string',  description: 'Active QA configuration preset (development/balanced/strict/cost_optimized/custom).' },
  QA_RETRY_STRATEGY:                { value: 'page_only',   type: 'string',  description: 'Retry strategy: never / page_only / scene / story.' },
  QA_MODE:                          { value: 'balanced',    type: 'string',  description: 'QA mode: fast / balanced / strict / debug.' },

  // ── Budget protection ─────────────────────────────────────────────────────────
  QA_MAX_COST_PER_STORY:            { value: '0.35',        type: 'number',  description: 'Maximum AI cost per story in USD.' },
  QA_MAX_COST_PER_AVATAR:           { value: '0.10',        type: 'number',  description: 'Maximum AI cost per avatar in USD.' },
  QA_MAX_COST_PER_PAGE:             { value: '0.05',        type: 'number',  description: 'Maximum AI cost per story page in USD.' },
  QA_STOP_REGEN_ON_BUDGET:          { value: 'true',        type: 'boolean', description: 'Stop auto-regeneration if per-story budget is exceeded.' },
  QA_NOTIFY_ADMIN_ON_BUDGET:        { value: 'true',        type: 'boolean', description: 'Notify admin if daily budget threshold is exceeded.' },
  QA_DAILY_BUDGET_ALERT:            { value: '50',          type: 'number',  description: 'Daily AI spend threshold (USD) that triggers an admin alert.' },
  QA_MONTHLY_BUDGET_ALERT:          { value: '1000',        type: 'number',  description: 'Monthly AI spend threshold (USD) that triggers an admin alert.' },

  // ── Advanced / developer options ──────────────────────────────────────────────
  QA_FORCE_REGENERATION:            { value: 'false',       type: 'boolean', description: 'Force regeneration of all pages regardless of QA score.' },
  QA_DISABLE_CHARACTER_CANON:       { value: 'false',       type: 'boolean', description: 'Disable character canon lookups during generation.' },
  QA_DISABLE_STORY_STATE:           { value: 'false',       type: 'boolean', description: 'Disable story state tracker.' },
  QA_DISABLE_SPEECH_BUBBLES:        { value: 'false',       type: 'boolean', description: 'Disable speech bubble engine.' },
  QA_DISABLE_CONFIDENCE_ENGINE:     { value: 'false',       type: 'boolean', description: 'Disable the confidence scoring engine.' },
  QA_DISABLE_QA_LOGGING:            { value: 'false',       type: 'boolean', description: 'Disable writing QA results to story_qa_runs / story_qa_pages.' },
  QA_PROMPT_VERSION_OVERRIDE:       { value: '',            type: 'string',  description: 'Override active prompt version for A/B testing.' },
  QA_MODEL_OVERRIDE:                { value: '',            type: 'string',  description: 'Override AI model for generation (leave empty to use defaults).' },

  // ── Audit ─────────────────────────────────────────────────────────────────────
  QA_LAST_MODIFIED_BY:              { value: '',            type: 'string',  description: 'Email of last admin to save QA settings.' },
  QA_LAST_MODIFIED_ON:              { value: '',            type: 'string',  description: 'ISO timestamp of last QA settings save.' },
  QA_SETTINGS_VERSION:              { value: '1.0',         type: 'string',  description: 'QA settings schema version — increment on breaking changes.' },
};

export function normalizeSettingValue(type: PlatformSettingType, value: unknown): string {
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return value ? 'true' : 'false';
    if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase()) ? 'true' : 'false';
    return 'false';
  }

  if (type === 'number') {
    const num = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    return Number.isFinite(num) ? String(num) : '0';
  }

  return value === null || value === undefined ? '' : String(value);
}

export function parseSettingValue(setting: { value: string; type: PlatformSettingType }) {
  if (setting.type === 'boolean') return setting.value === 'true';
  if (setting.type === 'number') return Number(setting.value);
  return setting.value;
}

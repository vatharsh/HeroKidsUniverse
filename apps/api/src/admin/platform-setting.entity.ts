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

export const SETTING_DEFAULTS: Record<string, PlatformSettingDefinition> = {
  AI_DAILY_COST_WARNING_USD:      { value: '10',  type: 'number',  description: 'Alert threshold for daily AI spend (USD)' },
  AI_MONTHLY_COST_WARNING_USD:    { value: '200', type: 'number',  description: 'Alert threshold for monthly AI spend (USD)' },
  AI_DAILY_COST_HARD_LIMIT_USD:   { value: '25',  type: 'number',  description: 'Hard stop threshold for daily AI spend (USD)' },
  AI_MONTHLY_COST_HARD_LIMIT_USD:  { value: '500', type: 'number',  description: 'Hard stop threshold for monthly AI spend (USD)' },
  BASIC_PLAN_PAGES:               { value: '6',   type: 'number',  description: 'Default number of pages for the Basic plan' },
  DISPLAY_CURRENCY:               { value: 'INR', type: 'string',  description: 'Primary currency shown in admin dashboards' },
  ENABLE_INDIAN_ENGLISH_NARRATION:{ value: 'true', type: 'boolean', description: 'Enable Indian English narration prompts and voices' },
  ENABLE_INFLUENCER_PROGRAM:      { value: 'false', type: 'boolean', description: 'Show influencer program admin tools' },
  ENABLE_MERCHANDISE:             { value: 'false', type: 'boolean', description: 'Show merchandise-related product surfaces' },
  ENABLE_NARRATION:               { value: 'true', type: 'boolean', description: 'Enable narration generation' },
  ENABLE_PHYSICAL_ORDERS:         { value: 'false', type: 'boolean', description: 'Show physical order options' },
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
  OPENAI_IMAGE_COST_PER_IMAGE:      { value: '0.04',     type: 'number', description: 'OpenAI image generation cost per image (USD). Default: gpt-image-1 medium quality.' },
  OPENAI_TTS_COST_PER_CHAR:         { value: '0.000015', type: 'number', description: 'OpenAI TTS cost per character (USD). Default: gpt-4o-mini-tts at $15/1M chars.' },
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

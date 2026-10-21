import { AsyncLocalStorage } from 'async_hooks';
import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { AiOperation, AiUsageLog } from './entities/ai-usage-log.entity';
import { geminiTextPrice } from './gemini-pricing';
import { isSandboxFor } from '../common/sandbox';

interface UsageContext {
  userId?: string | null;
  storyId?: string | null;
  universeId?: string | null;
  isSandbox?: boolean;
}

/**
 * Who an AI call is for. Story generation runs inside `aiUsageContext.run({ userId, storyId, ... })`,
 * so calls made deep inside providers (safety review, bubble detection, quality checks) are logged
 * against the right story without passing ids through every function.
 */
export const aiUsageContext = new AsyncLocalStorage<UsageContext>();

/** gpt-4o-mini list price (USD per 1M tokens). Image inputs are already counted in its token usage. */
const OPENAI_MINI_PRICE = { input: 0.15, output: 0.6 };

export interface UsageRecord {
  provider: 'gemini' | 'openai';
  model: string;
  operation: AiOperation;
  inputTokens?: number;
  outputTokens?: number;
  userId?: string | null;
}

/**
 * Logs the small supporting AI calls (safety review, speech-bubble detection, quality and appearance
 * checks) to ai_usage_logs, so AI Analytics shows everything Google and OpenAI will bill.
 */
@Injectable()
export class AiUsageRecorder {
  private readonly logger = new Logger(AiUsageRecorder.name);

  constructor(private readonly dataSource: DataSource) {}

  async record(entry: UsageRecord): Promise<void> {
    try {
      const ctx = aiUsageContext.getStore() ?? {};
      const inputTokens = Math.max(0, Math.round(entry.inputTokens ?? 0));
      const outputTokens = Math.max(0, Math.round(entry.outputTokens ?? 0));
      const price = entry.provider === 'openai'
        ? OPENAI_MINI_PRICE
        : geminiTextPrice(entry.model) ?? await this.settingsGeminiPrice();
      await this.dataSource.getRepository(AiUsageLog).save({
        userId: entry.userId ?? ctx.userId ?? null,
        storyId: ctx.storyId ?? null,
        universeId: ctx.universeId ?? null,
        provider: entry.provider,
        model: entry.model,
        operation: entry.operation,
        inputTokens,
        outputTokens,
        estimatedCostUsd: (inputTokens * price.input + outputTokens * price.output) / 1_000_000,
        isSandbox: ctx.isSandbox ?? await isSandboxFor(this.dataSource, entry.userId ?? ctx.userId),
      });
    } catch (err) {
      this.logger.warn(`AI usage not logged (${entry.operation}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Fallback for Gemini models without a known list price (Settings → AI Model Pricing). */
  private async settingsGeminiPrice(): Promise<{ input: number; output: number }> {
    const settings = this.dataSource.getRepository(PlatformSetting);
    const read = async (key: string) => {
      const row = await settings.findOne({ where: { key } });
      const value = Number(row?.value ?? SETTING_DEFAULTS[key]?.value ?? 0);
      return Number.isFinite(value) ? value : 0;
    };
    return { input: await read('GEMINI_INPUT_COST_PER_1M_TOKENS'), output: await read('GEMINI_OUTPUT_COST_PER_1M_TOKENS') };
  }
}

@Global()
@Module({ providers: [AiUsageRecorder], exports: [AiUsageRecorder] })
export class AiUsageModule {}

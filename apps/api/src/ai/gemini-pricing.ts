/**
 * Gemini text/vision list prices (USD per 1M tokens), with the date each price stops applying.
 * Models not listed here fall back to Settings → AI Model Pricing (GEMINI_INPUT/OUTPUT_COST_PER_1M_TOKENS).
 */
interface PricePeriod {
  input: number;
  output: number;
  /** Price applies before this date (exclusive); omit for "from then on". */
  until?: string;
}

const GEMINI_TEXT_PRICES: Record<string, PricePeriod[]> = {
  // Paid tier, from ai.google.dev/pricing (output includes thinking tokens).
  'gemini-3.8-flash': [
    { input: 0.75, output: 3.75, until: '2027-01-01' },
    { input: 1.5, output: 7.5 },
  ],
};

export function geminiTextPrice(model: string, at: Date = new Date()): { input: number; output: number } | null {
  const periods = GEMINI_TEXT_PRICES[model];
  if (!periods) return null;
  const period = periods.find((p) => !p.until || at < new Date(`${p.until}T00:00:00Z`)) ?? periods[periods.length - 1];
  return { input: period.input, output: period.output };
}

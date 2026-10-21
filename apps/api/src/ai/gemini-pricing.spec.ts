import { geminiTextPrice } from './gemini-pricing';

describe('geminiTextPrice', () => {
  it('uses the 2026 price for gemini-3.8-flash before 2027', () => {
    expect(geminiTextPrice('gemini-3.8-flash', new Date('2026-12-31T23:00:00Z'))).toEqual({ input: 0.75, output: 3.75 });
  });

  it('switches to the 2027 price on 1 January 2027', () => {
    expect(geminiTextPrice('gemini-3.8-flash', new Date('2027-01-01T00:00:00Z'))).toEqual({ input: 1.5, output: 7.5 });
  });

  it('returns null for models without a known price (Settings are used instead)', () => {
    expect(geminiTextPrice('gemini-3.1-flash-lite')).toBeNull();
  });
});

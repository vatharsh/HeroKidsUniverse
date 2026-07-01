import { GeminiStoryProvider } from './gemini-story.provider';

describe('GeminiStoryProvider prompt registry wiring', () => {
  it('injects the active story_generation registry prompt into the generated prompt', async () => {
    const provider = new GeminiStoryProvider(
      { get: jest.fn((key: string) => key === 'GEMINI_API_KEY' ? 'test-key' : undefined) } as any,
      {
        getActivePrompt: jest.fn().mockResolvedValue({
          id: 'version-1',
          promptTemplateId: 'template-1',
          version: 'v9',
          promptText: 'REGISTRY RULE: use moon crystals.',
        }),
      } as any,
    );

    const prompt = await (provider as any).buildPrompt({
      heroName: 'Siddhant',
      heroAge: 8,
      heroGender: 'boy',
      themeDescription: 'space adventure',
      pageCount: 6,
      supportingCharacters: [],
    });

    expect(prompt).toContain('ACTIVE PROMPT REGISTRY RULES');
    expect(prompt).toContain('REGISTRY RULE: use moon crystals.');
  });

  it('falls back to hardcoded prompt structure when no active prompt exists', async () => {
    const provider = new GeminiStoryProvider(
      { get: jest.fn((key: string) => key === 'GEMINI_API_KEY' ? 'test-key' : undefined) } as any,
      { getActivePrompt: jest.fn().mockResolvedValue(null) } as any,
    );

    const prompt = await (provider as any).buildPrompt({
      heroName: 'Siddhant',
      heroAge: 8,
      heroGender: 'boy',
      themeDescription: 'space adventure',
      pageCount: 6,
      supportingCharacters: [],
    });

    expect(prompt).toContain('Respond with ONLY valid JSON');
    expect(prompt).not.toContain('ACTIVE PROMPT REGISTRY RULES');
  });
});

describe('GeminiStoryProvider prompt caching fix', () => {
  it('calls getActivePrompt on every buildPrompt invocation (no stale cache)', async () => {
    const getActivePrompt = jest.fn()
      .mockResolvedValueOnce({ id: 'v1', promptTemplateId: 'tpl', version: '1.0', promptText: 'Rule A.' })
      .mockResolvedValueOnce({ id: 'v2', promptTemplateId: 'tpl', version: '2.0', promptText: 'Rule B.' });

    const provider = new GeminiStoryProvider(
      { get: jest.fn((key: string) => key === 'GEMINI_API_KEY' ? 'test-key' : undefined) } as any,
      { getActivePrompt } as any,
    );

    const input = { heroName: 'Arjun', heroAge: 7, heroGender: 'boy', themeDescription: 'ninja', pageCount: 4, supportingCharacters: [] };

    const prompt1 = await (provider as any).buildPrompt(input);
    const prompt2 = await (provider as any).buildPrompt(input);

    expect(getActivePrompt).toHaveBeenCalledTimes(2);
    expect(prompt1).toContain('Rule A.');
    expect(prompt2).toContain('Rule B.');
  });

  it('does not retain stale prompt after registry returns null', async () => {
    const getActivePrompt = jest.fn()
      .mockResolvedValueOnce({ id: 'v1', promptTemplateId: 'tpl', version: '1.0', promptText: 'Rule A.' })
      .mockResolvedValueOnce(null); // prompt deleted/archived

    const provider = new GeminiStoryProvider(
      { get: jest.fn((key: string) => key === 'GEMINI_API_KEY' ? 'test-key' : undefined) } as any,
      { getActivePrompt } as any,
    );

    const input = { heroName: 'Arjun', heroAge: 7, heroGender: 'boy', themeDescription: 'ninja', pageCount: 4, supportingCharacters: [] };

    await (provider as any).buildPrompt(input); // loads v1
    const prompt2 = await (provider as any).buildPrompt(input); // should NOT use v1

    expect(prompt2).not.toContain('Rule A.');
    expect(prompt2).not.toContain('ACTIVE PROMPT REGISTRY RULES');
  });
});

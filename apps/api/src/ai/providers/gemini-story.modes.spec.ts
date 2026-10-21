import { ConfigService } from '@nestjs/config';

import { StoryMode } from '../../stories/story.entity';
import type { StoryGenerationInput, UniverseContext } from '../interfaces/story-generation.provider';
import type { PromptRegistryService } from '../prompt-registry.service';
import { GeminiStoryProvider } from './gemini-story.provider';

/** Checks what the writer is told for each kind of story — no AI calls. */
describe('GeminiStoryProvider prompt per story type', () => {
  const provider = new GeminiStoryProvider(new ConfigService({}), {} as PromptRegistryService);
  const vars = (input: StoryGenerationInput) =>
    (provider as unknown as { computePromptVariables(i: StoryGenerationInput): Record<string, string> }).computePromptVariables(input);

  const universe = (storyMode: StoryMode, extra: Partial<UniverseContext> = {}): UniverseContext => ({
    universeName: 'Siddhant Universe',
    heroTitle: 'Commander',
    recentMemories: [],
    openQuests: [],
    heroPowers: [],
    storyContext: null,
    storyMode,
    lastCliffhanger: 'Just then, the compass began to glow red.',
    lastStoryTitle: 'The Great Laddoo Heist',
    storyShape: { key: 'mystery', label: 'Mystery', brief: 'Follow clues.' },
    ...extra,
  });

  const base: StoryGenerationInput = {
    heroName: 'Siddhant',
    heroAge: 8,
    heroGender: 'boy',
    themeDescription: 'an exciting space adventure',
    pageCount: 8,
  } as StoryGenerationInput;

  it('New Adventure: fresh story, told NOT to continue the cliffhanger', () => {
    const v = vars({ ...base, universeContext: universe(StoryMode.NewAdventure) });
    expect(v.universeSection).toContain('NEW ADVENTURE');
    expect(v.universeSection).toContain('Do NOT continue the last episode');
    expect(v.universeSection).not.toContain('Page 1 MUST open exactly where');
    expect(v.universeSection).toContain('STORY SHAPE FOR THIS EPISODE');
  });

  it('Continue Adventure: must open on the last cliffhanger', () => {
    const v = vars({ ...base, universeContext: universe(StoryMode.ContinueArc, { storyShape: null }) });
    expect(v.universeSection).toContain('CONTINUE ADVENTURE');
    expect(v.universeSection).toContain('Just then, the compass began to glow red.');
    expect(v.universeSection).toContain('Page 1 MUST open exactly where');
    expect(v.universeSection).not.toContain('STORY SHAPE FOR THIS EPISODE');
  });

  it('Continue Adventure with the parent\'s own idea still continues the cliffhanger', () => {
    const v = vars({ ...base, storyContext: 'Dadi helps open the glowing chest', universeContext: universe(StoryMode.ContinueArc, { storyShape: null }) });
    expect(v.universeSection).toContain('Page 1 MUST open exactly where');
    expect(v.universeSection).toContain("parent's story idea describes what happens next");
    expect(v.customStoryDirective).toContain('Dadi helps open the glowing chest');
  });

  it('Continue Adventure with no earlier episode starts fresh', () => {
    const v = vars({ ...base, universeContext: universe(StoryMode.ContinueArc, { lastCliffhanger: null, lastStoryTitle: null }) });
    expect(v.universeSection).toContain('no earlier episode to continue');
  });

  it('New Story Arc: new long goal, opens a quest, does not continue', () => {
    const v = vars({ ...base, universeContext: universe(StoryMode.NewArc) });
    expect(v.universeSection).toContain('NEW STORY ARC');
    expect(v.universeSection).toContain('open it as a quest');
    expect(v.universeSection).toContain('Do NOT continue the last episode');
  });

  it('Standalone: no universe rules at all', () => {
    const v = vars({ ...base });
    expect(v.universeSection).toBe('');
    expect(v.themeDescriptionLine).toContain('space adventure');
  });

  it('Standalone with own idea only: follows the idea, no theme line', () => {
    const v = vars({ ...base, storyContext: 'A picnic where the kites come alive' });
    expect(v.customStoryDirective).toContain('A picnic where the kites come alive');
    expect(v.themeDescriptionLine).toBe('');
  });

  it('Theme AND own idea: the idea is the story, the theme sets the scene', () => {
    const v = vars({ ...base, storyContext: 'Rescue Dadi\'s lost cat', chosenTheme: 'an exciting space adventure' });
    expect(v.customStoryDirective).toContain("Rescue Dadi's lost cat");
    expect(v.themeDescriptionLine).toContain('Setting: an exciting space adventure');
  });
});

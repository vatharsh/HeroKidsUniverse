import { StoryMode } from '../../stories/story.entity';

export const STORY_GENERATION_PROVIDER = 'STORY_GENERATION_PROVIDER';

export interface UniverseContext {
  universeName: string;
  heroTitle: string | null;
  recentMemories: string[];
  openQuests: string[];
  heroPowers: string[];
  storyContext: string | null;
  storyMode: StoryMode;
  lastCliffhanger: string | null;
  lastStoryTitle: string | null;
  companion?: {
    name: string;
    type: string;
  } | null;
}

export interface StoryGenerationInput {
  heroName: string;
  heroAge: number;
  heroGender: string;
  themeDescription: string;
  pageCount: number;
  supportingCharacters?: string[];
  universeContext?: UniverseContext;
  /** User-provided story context — when set, it OVERRIDES universe-driven story generation */
  storyContext?: string;
}

export interface StoryGenerationOutput {
  title: string;
  cliffhanger?: string;
  newPowers?: string[];
  newQuests?: string[];
  newMemories?: Array<{ type: string; title: string; detail?: string }>;
  pages: Array<{ pageNumber: number; text: string; sceneDescription: string }>;
  provider?: string;
  model?: string;
  prompt?: string;
  rawResponse?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface StoryGenerationProvider {
  generateStory(input: StoryGenerationInput): Promise<StoryGenerationOutput>;
}

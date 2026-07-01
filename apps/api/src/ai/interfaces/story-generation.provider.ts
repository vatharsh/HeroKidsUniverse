import { StoryMode } from '../../stories/story.entity';

export const STORY_GENERATION_PROVIDER = 'STORY_GENERATION_PROVIDER';

export type SpeechBubbleStyle = 'normal' | 'excited' | 'whisper' | 'thinking' | 'surprised';

export interface ExpressionDetails {
  eyes?: string;
  mouth?: string;
  eyebrows?: string;
  gaze?: string;
  headTilt?: string;
}

export interface PageDialogue {
  speaker: string;
  text: string;
  emotion?: string;
  bubbleStyle?: SpeechBubbleStyle;
  placementHint?: string;
}

export interface PageCharacter {
  name: string;
  expression?: string;
  pose?: string;
  expressionDetails?: ExpressionDetails;
  facingDirection?: string;
  gazeDirection?: string;
  isSpeaking?: boolean;
  reactionToScene?: string;
}

export interface PageCharacterDirection {
  characterId?: string;
  name: string;
  role?: string;
  visible?: boolean;
  /** Where in the frame the character stands */
  position?: 'left' | 'center' | 'right' | 'foreground' | 'background';
  expression: string;
  expressionDetails?: ExpressionDetails;
  pose: string;
  action?: string;
  lookingAt?: string;
  facingDirection?: string;
  gazeDirection?: string;
  mouthState?: 'speaking' | 'closed' | 'smiling' | 'surprised';
  isSpeaking?: boolean;
  reactionToScene?: string;
  requiredVisibleFeatures?: string[];
}

export interface SpeechBubbleMetadata {
  speakerCharacterId?: string;
  speakerName: string;
  text: string;
  emotion?: string;
  bubbleStyle: SpeechBubbleStyle;
  /** Structured placement — preferred over legacy placementHint */
  preferredPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  tailDirection?: 'down-left' | 'down-right' | 'up-left' | 'up-right';
  avoidCovering?: string[];
  maxWidthPercent?: number;
  anchor?: 'mouth' | 'lower_face' | 'head' | 'upper_left' | 'upper_right';
  anchorTarget?: 'mouth' | 'lower_face' | 'head';
  anchorPoint?: { x: number; y: number };
  bubbleRect?: { x: number; y: number; width: number; height: number };
  layoutConfidence?: number;
  /** Legacy free-text hint — kept for backward compat */
  placementHint?: string;
  priority?: number;
}

export interface PageStoryStateUpdate {
  newItems?: string[];
  removedItems?: string[];
  newPowers?: string[];
  removedPowers?: string[];
  newCompanions?: string[];
  removedCompanions?: string[];
  locationChange?: string;
  costumeChange?: string;
}

export interface StoryVisualStateOutput {
  costume: string | null;
  companion: string | null;
  weapon: string | null;
  powers: string[];
  inventory: string[];
}

export interface SceneOutput {
  sceneId: string;
  title: string;
  illustrationBrief: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    narrationText?: string;
    sceneDescription: string;
    dialogue?: PageDialogue[];
    characters?: PageCharacter[];
    camera?: string;
    cropHint?: string;
    background?: string;
    characterDirections?: PageCharacterDirection[];
    speechBubbles?: SpeechBubbleMetadata[];
    storyStateUpdate?: PageStoryStateUpdate;
  }>;
}

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
  visualState?: {
    costume: string | null;
    colorPalette: string | null;
    companion: string | null;
    weapon: string | null;
    vehicle: string | null;
    heroPowerVisual: string | null;
    badgeStyle: string | null;
  } | null;
}

export interface StoryGenerationInput {
  heroName: string;
  heroAge: number;
  heroGender: string;
  heroVisualDescription?: string;
  themeDescription: string;
  pageCount: number;
  supportingCharacters?: string[];
  supportingCharacterVisualDescriptions?: string[];
  universeContext?: UniverseContext;
  /** User-provided story context — when set, it OVERRIDES universe-driven story generation */
  storyContext?: string;
  storyVisualState?: {
    costume: string | null;
    companion: string | null;
    weapon: string | null;
    powers: string[];
    inventory: string[];
  } | null;
}

export interface StoryGenerationOutput {
  title: string;
  cliffhanger?: string;
  storyVisualState?: StoryVisualStateOutput;
  scenes?: SceneOutput[];
  newPowers?: string[];
  newQuests?: string[];
  newMemories?: Array<{ type: string; title: string; detail?: string }>;
  pages: Array<{
    pageNumber: number;
    text: string;
    narrationText?: string;
    sceneDescription: string;
    dialogue?: PageDialogue[];
    characters?: PageCharacter[];
    camera?: string;
    cropHint?: string;
    sceneId?: string;
    background?: string;
    characterDirections?: PageCharacterDirection[];
    speechBubbles?: SpeechBubbleMetadata[];
    storyStateUpdate?: PageStoryStateUpdate;
  }>;
  provider?: string;
  model?: string;
  prompt?: string;
  promptKey?: string | null;
  promptTemplateId?: string | null;
  promptTemplateVersionId?: string | null;
  promptVersion?: string | null;
  rawResponse?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface StoryGenerationProvider {
  generateStory(input: StoryGenerationInput): Promise<StoryGenerationOutput>;
}

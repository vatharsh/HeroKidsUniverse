import { StoryMode } from '../../stories/story.entity';

export const STORY_GENERATION_PROVIDER = 'STORY_GENERATION_PROVIDER';

export type SpeechBubbleStyle = 'normal' | 'excited' | 'whisper' | 'thinking' | 'surprised';

export type ImageVariant = 'reuse' | 'expression';

export interface ParticipationMoment {
  type: 'riddle' | 'predict' | 'guess' | 'choose';
  prompt: string;
  hint?: string;
}

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
  /** One outfit per named non-hero character, fixed for the whole story. */
  characterOutfits?: Record<string, string>;
  /** Fixed appearance for characters with no photo (villains, creatures, companions). */
  characterLooks?: Record<string, string>;
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
    imageVariant?: ImageVariant;
    participationMoment?: ParticipationMoment | null;
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
  /** Last few episodes, newest first — the writer must not repeat their titles, settings or villains. */
  recentEpisodes?: Array<{ title: string; shape: string | null; villain: string | null }>;
  /** The kind of plot this episode must follow (picked to differ from recent episodes). */
  storyShape?: { key: string; label: string; brief: string } | null;
  /** A villain who escaped before and comes back this episode, with their fixed look. */
  returningVillain?: { name: string; look: string | null; scheme: string | null; lastEpisode: string | null } | null;
  /** Villain names already used in this universe (a new villain must have a different name and type). */
  pastVillains?: string[];
  /** Physical items the hero has earned and can carry. */
  heroGear?: Array<{ name: string; emoji: string | null; description: string | null; look: string | null }>;
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
  /** This episode's main villain and how their story ended. */
  villain?: { name?: string; look?: string; scheme?: string; outcome?: string } | null;
  /** What the hero earned — usually a physical artifact. */
  reward?: { name?: string; kind?: string; emoji?: string; description?: string; look?: string } | null;
  /** Titles of open quests this episode resolved. */
  questsCompleted?: string[];
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
    imageVariant?: ImageVariant;
    participationMoment?: ParticipationMoment | null;
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

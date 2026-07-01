export const IMAGE_GENERATION_PROVIDER = 'IMAGE_GENERATION_PROVIDER';

export interface ImageGenerationInput {
  sceneDescription: string;
  heroName: string;
  heroAge: number;
  style?: string;
  supportingCharacters?: string[]; // e.g. ["Vedant (sibling)", "Luna (friend)"]
  heroAvatarUrl?: string;          // used as reference image for visual consistency
  heroAvatarDescription?: string;  // text description of hero appearance extracted via GPT-4V
  characterAvatarUrls?: string[];  // one per supporting character, same order
  characterAvatarDescriptions?: string[]; // one per supporting character, same order
  styleReferenceUrl?: string;      // first page's image — used to lock visual style across all pages
  storyVisualState?: {
    costume: string | null;
    companion: string | null;
    weapon: string | null;
    powers: string[];
    inventory: string[];
  } | null;
  dialogue?: Array<{ speaker: string; text: string; emotion?: string }>;
  characters?: Array<{ name: string; expression?: string; pose?: string }>;
  camera?: string;
  identityBoostMode?: boolean; // regeneration pass after a failed face consistency check
  backgroundOnlyMode?: boolean; // generate scene/environment only — hero avatar will be overlaid by frontend
  heroCanonSummary?: string;
  heroNeverChangeRules?: string[];
  heroFaceMetrics?: string;
  characterCanonSummaries?: string[];
  storyStateBlock?: string;
  characterDirections?: Array<{
    name: string;
    role?: string;
    visible?: boolean;
    position?: 'left' | 'center' | 'right' | 'foreground' | 'background';
    expression: string;
    expressionDetails?: { eyes?: string; mouth?: string; eyebrows?: string; gaze?: string; headTilt?: string };
    pose: string;
    action?: string;
    lookingAt?: string;
    facingDirection?: string;
    gazeDirection?: string;
    mouthState?: 'speaking' | 'closed' | 'smiling' | 'surprised';
    isSpeaking?: boolean;
    reactionToScene?: string;
    requiredVisibleFeatures?: string[];
  }>;
}

export interface ImageGenerationOutput {
  imageUrl: string;
  imageBase64?: string;
}

export interface FaceConsistencyResult {
  identityScore: number; // 1–10
  issues: string[];
  suggestions?: string[];
  recommendation: 'accept' | 'regenerate';
}

export interface SpeechBubbleLayoutInput {
  imageUrl?: string;
  imageBase64?: string;
  pageNumber: number;
  sceneDescription?: string;
  characterDirections?: Array<{
    name: string;
    position?: 'left' | 'center' | 'right' | 'foreground' | 'background';
    isSpeaking?: boolean;
    mouthState?: 'speaking' | 'closed' | 'smiling' | 'surprised';
  }>;
  speechBubbles: Array<{
    speakerName: string;
    text: string;
    preferredPosition?: string;
    tailDirection?: string;
  }>;
}

export interface SpeechBubbleLayoutResult {
  bubbles: Array<{
    speakerName: string;
    text: string;
    anchorPoint: { x: number; y: number };
    bubbleRect: { x: number; y: number; width: number; height: number };
    confidence: number;
    reason?: string;
  }>;
}

export interface AvatarGenerationInput {
  name: string;
  role?: string;
  photoBuffer?: Buffer;
  photoMimeType?: string;
  adjustmentHint?: string;
}

export interface ImageGenerationProvider {
  generateImage(input: ImageGenerationInput): Promise<ImageGenerationOutput>;
  generateAvatar(input: AvatarGenerationInput): Promise<ImageGenerationOutput>;
  describeCharacterAppearance(photoBuffer: Buffer, mimeType?: string): Promise<string | null>;
  describeCharacterAppearanceFromUrl(url: string): Promise<string | null>;
  extractStructuredIdentity(description: string): Promise<import('../../heroes/hero.entity').CharacterIdentity | null>;
  checkFaceConsistency(heroAvatarUrl: string, generatedImageBase64: string, heroName: string): Promise<FaceConsistencyResult | null>;
  checkFaceConsistencyFromUrl(heroAvatarUrl: string, generatedImageUrl: string, heroName: string): Promise<FaceConsistencyResult | null>;
  locateSpeechBubbleAnchors(input: SpeechBubbleLayoutInput): Promise<SpeechBubbleLayoutResult | null>;
}

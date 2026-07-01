import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Hero } from '../heroes/hero.entity';
import { User } from '../users/user.entity';

export enum StoryTheme {
  SpaceAdventure = 'space-adventure',
  SuperheroMission = 'superhero-mission',
  JungleQuest = 'jungle-quest',
  UnderwaterAdventure = 'underwater-adventure',
  DetectiveMystery = 'detective-mystery',
  BirthdayAdventure = 'birthday-adventure',
}

export enum StoryStatus {
  Pending = 'pending',
  GeneratingStory = 'generating-story',
  GeneratingImages = 'generating-images',
  GeneratingAudio = 'generating-audio',
  GeneratingPdf = 'generating-pdf',
  Completed = 'completed',
  Failed = 'failed',
}

export enum StoryMode {
  NewAdventure = 'new_adventure',
  ContinueArc = 'continue_arc',
  NewArc = 'new_arc',
  Standalone = 'standalone',
}

export enum VideoStatus {
  NotStarted = 'not_started',
  Generating  = 'generating',
  Completed   = 'completed',
  Failed      = 'failed',
}

export interface PageDialogue {
  speaker: string;
  text: string;
  emotion?: string;
  bubbleStyle?: string;
  placementHint?: string;
}

export interface PageCharacter {
  name: string;
  expression?: string;
  pose?: string;
  expressionDetails?: { eyes?: string; mouth?: string; eyebrows?: string; gaze?: string; headTilt?: string };
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
}

export interface SpeechBubbleMetadata {
  speakerCharacterId?: string;
  speakerName: string;
  text: string;
  emotion?: string;
  bubbleStyle?: string;
  preferredPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  tailDirection?: 'down-left' | 'down-right' | 'up-left' | 'up-right';
  avoidCovering?: string[];
  maxWidthPercent?: number;
  anchor?: 'mouth' | 'lower_face' | 'head' | 'upper_left' | 'upper_right';
  anchorTarget?: 'mouth' | 'lower_face' | 'head';
  anchorPoint?: { x: number; y: number };
  bubbleRect?: { x: number; y: number; width: number; height: number };
  layoutConfidence?: number;
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

export interface StoryPage {
  pageNumber: number;
  text: string;
  narrationText?: string;
  finalNarrationText?: string;
  imageUrl?: string;
  audioUrl?: string;
  sceneDescription?: string;
  dialogue?: PageDialogue[];
  characters?: PageCharacter[];
  camera?: string;
  cropHint?: string;
  sceneId?: string;
  background?: string;
  speechBubbles?: Array<{
    speakerCharacterId?: string;
    speakerName: string;
    text: string;
    emotion?: string;
    bubbleStyle?: string;
    preferredPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    tailDirection?: 'down-left' | 'down-right' | 'up-left' | 'up-right';
    avoidCovering?: string[];
    maxWidthPercent?: number;
    anchor?: 'mouth' | 'lower_face' | 'head' | 'upper_left' | 'upper_right';
    anchorTarget?: 'mouth' | 'lower_face' | 'head';
    anchorPoint?: { x: number; y: number };
    bubbleRect?: { x: number; y: number; width: number; height: number };
    layoutConfidence?: number;
    placementHint?: string;
    priority?: number;
  }>;
  storyStateSnapshot?: {
    location?: string;
    costume?: string;
    items?: string[];
    powers?: string[];
    companions?: string[];
  };
  imagePromptUsed?: string;
  characterDirections?: PageCharacterDirection[];
  storyStateUpdate?: PageStoryStateUpdate;
}

export interface StoryVisualState {
  costume: string | null;
  companion: string | null;
  weapon: string | null;
  powers: string[];
  inventory: string[];
  transformation: string | null;
  currentLocation?: string;
}

export interface StoryScene {
  sceneId: string;
  title: string;
  illustrationUrl: string | null;
  illustrationBrief: string;
  pageNumbers: number[];
}

@Entity('stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  heroId!: string;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'enum', enum: StoryTheme, nullable: true })
  theme!: StoryTheme | null;

  @Column({ type: 'enum', enum: StoryMode, default: StoryMode.NewAdventure })
  storyMode!: StoryMode;

  @Column({ type: 'text', nullable: true })
  storyContext!: string | null;

  @Column({ type: 'text', nullable: true })
  cliffhanger!: string | null;

  @Column({ type: 'uuid', nullable: true })
  arcId!: string | null;

  @Column({ type: 'text', nullable: true })
  title!: string | null;

  @Column({ type: 'enum', enum: StoryStatus, default: StoryStatus.Pending })
  status!: StoryStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  pages!: StoryPage[];

  @Column({ type: 'jsonb', nullable: true })
  storyVisualState!: StoryVisualState | null;

  @Column({ type: 'jsonb', nullable: true })
  scenes!: StoryScene[] | null;

  @Column({ type: 'text', nullable: true })
  coverImageUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  pdfUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  characterIds!: string[] | null;

  @Column({ type: 'smallint', default: 1 })
  creditsUsed!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'text', nullable: true })
  videoUrl!: string | null;

  @Column({ type: 'enum', enum: VideoStatus, nullable: true })
  videoStatus!: VideoStatus | null;

  @Column({ type: 'boolean', default: false })
  isSandbox!: boolean;

  @Column({ type: 'float', nullable: true })
  overallConfidence!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.stories, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Hero, (hero) => hero.stories, { onDelete: 'RESTRICT' })
  hero!: Hero;
}

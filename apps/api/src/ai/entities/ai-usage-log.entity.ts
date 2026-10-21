import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AiOperation {
  StoryGeneration = 'story_generation',
  ImageGeneration = 'image_generation',
  Narration = 'narration',
  AvatarGeneration = 'avatar_generation',
  CharacterSheetGeneration = 'character_sheet_generation',
  CoverGeneration = 'cover_generation',
  StoryPageGeneration = 'story_page_generation',
  VideoGeneration = 'video_generation',
  MerchandiseGeneration = 'merchandise_generation',
  StoryContinuation = 'story_continuation',
  /** Child-safety review of typed text, photos, stories and pictures. */
  SafetyCheck = 'safety_check',
  /** Finding speakers' heads and mouths to place speech bubbles. */
  SpeechBubbleDetection = 'speech_bubble_detection',
  /** Face-likeness and apparent-age checks on finished pictures. */
  QualityCheck = 'quality_check',
  /** Describing a character's appearance from a photo or avatar. */
  AppearanceAnalysis = 'appearance_analysis',
}

@Entity('ai_usage_logs')
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  storyId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'text' })
  provider!: string;

  @Column({ type: 'text' })
  model!: string;

  @Column({ type: 'enum', enum: AiOperation })
  operation!: AiOperation;

  @Column({ type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ type: 'int', default: 0 })
  outputTokens!: number;

  @Column({ type: 'int', default: 0 })
  imagesGenerated!: number;

  @Column({ type: 'int', default: 0 })
  audioSeconds!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  estimatedCostUsd!: number;

  @Column({ type: 'boolean', default: false })
  isSandbox!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}

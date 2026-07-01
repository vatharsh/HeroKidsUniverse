import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('story_qa_runs')
export class StoryQaRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', nullable: true })
  storyModel!: string | null;

  @Column({ type: 'text', nullable: true })
  imageModel!: string | null;

  @Column({ type: 'text', nullable: true })
  storyPromptVersion!: string | null;

  @Column({ type: 'text', nullable: true })
  imagePromptVersion!: string | null;

  @Column({ type: 'text', nullable: true })
  qaVersion!: string | null;

  @Column({ type: 'float', nullable: true })
  avgIdentityScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgStoryScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgExpressionScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgDialogueScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgCompositionScore!: number | null;

  @Column({ type: 'float', nullable: true })
  avgNarrationScore!: number | null;

  @Column({ type: 'float', nullable: true })
  overallConfidence!: number | null;

  @Column({ type: 'text', default: 'pending' })
  overallStatus!: string;

  @Column({ type: 'integer', default: 0 })
  pagesRetried!: number;

  @Column({ type: 'jsonb', nullable: true })
  topIssues!: string[] | null;

  @Column({ type: 'float', nullable: true })
  storyCostUsd!: number | null;

  @Column({ type: 'float', nullable: true })
  imageCostUsd!: number | null;

  @Column({ type: 'float', nullable: true })
  ttsCostUsd!: number | null;

  @Column({ type: 'integer', nullable: true })
  generationTimeMs!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}

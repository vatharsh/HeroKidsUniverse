import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('story_qa_pages')
export class StoryQaPage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  storyQaRunId!: string;

  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'integer' })
  pageNumber!: number;

  @Column({ type: 'float', nullable: true })
  identityScore!: number | null;

  @Column({ type: 'float', nullable: true })
  storyScore!: number | null;

  @Column({ type: 'float', nullable: true })
  expressionScore!: number | null;

  @Column({ type: 'float', nullable: true })
  dialogueScore!: number | null;

  @Column({ type: 'float', nullable: true })
  compositionScore!: number | null;

  @Column({ type: 'float', nullable: true })
  narrationScore!: number | null;

  @Column({ type: 'float', nullable: true })
  overallScore!: number | null;

  @Column({ type: 'boolean', default: true })
  accepted!: boolean;

  @Column({ type: 'integer', default: 0 })
  retryCount!: number;

  @Column({ type: 'jsonb', nullable: true })
  issues!: string[] | null;

  @Column({ type: 'text', nullable: true })
  acceptedImageUrl!: string | null;

  @Column({ type: 'float', nullable: true })
  imageCostUsd!: number | null;

  @Column({ type: 'float', nullable: true })
  ttsCostUsd!: number | null;

  @Column({ type: 'integer', nullable: true })
  generationTimeMs!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}

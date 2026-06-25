import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum JobStatus {
  Queued            = 'queued',
  GeneratingStory   = 'generating_story',
  GeneratingCover   = 'generating_cover',
  GeneratingImages  = 'generating_images',
  GeneratingAudio   = 'generating_audio',
  SavingMemory      = 'saving_memory',
  Completed         = 'completed',
  Failed            = 'failed',
}

@Entity('generation_jobs')
export class GenerationJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.Queued })
  status!: JobStatus;

  @Column({ type: 'text', nullable: true })
  currentStep!: string | null;

  @Column({ type: 'int', default: 0 })
  progressPercentage!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

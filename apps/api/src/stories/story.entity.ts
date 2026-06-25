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

export interface StoryPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.stories, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Hero, (hero) => hero.stories, { onDelete: 'RESTRICT' })
  hero!: Hero;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Universe } from '../universes/universe.entity';

export enum QuestStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Completed = 'completed',
}

@Entity('quests')
export class Quest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  universeId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: QuestStatus, default: QuestStatus.Open })
  status!: QuestStatus;

  @Column({ type: 'uuid', nullable: true })
  openedInStoryId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  completedInStoryId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Universe, (universe) => universe.quests, { onDelete: 'CASCADE' })
  universe!: Universe;
}

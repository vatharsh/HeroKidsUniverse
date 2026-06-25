import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Universe } from '../universes/universe.entity';

export enum ArcStatus {
  Active = 'active',
  Completed = 'completed',
}

@Entity('story_arcs')
export class StoryArc {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  universeId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'enum', enum: ArcStatus, default: ArcStatus.Active })
  status!: ArcStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Universe, (universe) => universe.arcs, { onDelete: 'CASCADE' })
  universe!: Universe;
}

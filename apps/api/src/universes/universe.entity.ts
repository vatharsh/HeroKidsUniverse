import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { HeroPower } from '../powers/hero-power.entity';
import { Quest } from '../quests/quest.entity';
import { StoryArc } from '../story-arcs/story-arc.entity';
import { User } from '../users/user.entity';
import { UniverseMemory } from './universe-memory.entity';

export interface UniverseVisualState {
  costume: string | null;
  colorPalette: string | null;
  companion: string | null;
  weapon: string | null;
  vehicle: string | null;
  heroPowerVisual: string | null;
  badgeStyle: string | null;
}

@Entity('universes')
export class Universe {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  heroTitle!: string | null;

  @Column({ type: 'text', nullable: true })
  tagline!: string | null;

  @Column({ type: 'text', nullable: true })
  coverImageUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  visualState!: UniverseVisualState | null;

  @Column({ type: 'boolean', default: false })
  isSandbox!: boolean;

  @Column({ type: 'float', nullable: true })
  avgConfidence!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @OneToMany(() => UniverseMemory, (memory) => memory.universe)
  memories!: UniverseMemory[];

  @OneToMany(() => Quest, (quest) => quest.universe)
  quests!: Quest[];

  @OneToMany(() => HeroPower, (power) => power.universe)
  powers!: HeroPower[];

  @OneToMany(() => StoryArc, (arc) => arc.universe)
  arcs!: StoryArc[];
}

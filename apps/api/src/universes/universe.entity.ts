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

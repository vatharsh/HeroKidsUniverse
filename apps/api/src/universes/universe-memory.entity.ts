import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Universe } from './universe.entity';

export enum MemoryType {
  CharacterMet = 'character_met',
  VillainDefeated = 'villain_defeated',
  PowerEarned = 'power_earned',
  ItemFound = 'item_found',
  LocationDiscovered = 'location_discovered',
  QuestOpened = 'quest_opened',
  QuestCompleted = 'quest_completed',
  AchievementUnlocked = 'achievement_unlocked',
}

@Entity('universe_memories')
export class UniverseMemory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  universeId!: string;

  @Column({ type: 'enum', enum: MemoryType })
  type!: MemoryType;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  detail!: string | null;

  @Column({ type: 'uuid', nullable: true })
  storyId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Universe, (universe) => universe.memories, { onDelete: 'CASCADE' })
  universe!: Universe;
}

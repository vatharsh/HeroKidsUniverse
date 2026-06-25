import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Universe } from '../universes/universe.entity';

@Entity('hero_powers')
export class HeroPower {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  universeId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  emoji!: string | null;

  @Column({ type: 'uuid', nullable: true })
  earnedInStoryId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Universe, (universe) => universe.powers, { onDelete: 'CASCADE' })
  universe!: Universe;
}

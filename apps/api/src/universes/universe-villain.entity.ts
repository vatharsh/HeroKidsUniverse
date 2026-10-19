import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { Universe } from './universe.entity';

/** How the villain's last episode ended — 'escaped' villains can come back in a later episode. */
export enum VillainStatus {
  Defeated = 'defeated',
  Escaped = 'escaped',
  Befriended = 'befriended',
  Captured = 'captured',
}

/** A villain the hero has met. Kept per universe so a villain can return, looking the same as before. */
@Entity('universe_villains')
@Index(['universeId', 'name'])
export class UniverseVillain {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  universeId!: string;

  @Column({ type: 'text' })
  name!: string;

  /** Fixed appearance, reused every time they appear so the pictures match. */
  @Column({ type: 'text', nullable: true })
  look!: string | null;

  /** What they were after, in one line. */
  @Column({ type: 'text', nullable: true })
  scheme!: string | null;

  @Column({ type: 'varchar', length: 20, default: VillainStatus.Defeated })
  status!: VillainStatus;

  @Column({ type: 'int', default: 1 })
  appearances!: number;

  @Column({ type: 'uuid', nullable: true })
  firstStoryId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  lastStoryId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Universe, (universe) => universe.villains, { onDelete: 'CASCADE' })
  universe!: Universe;
}

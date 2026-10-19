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

  /** 'artifact' = a physical item the hero carries (sword, amulet, compass); 'power' = an ability. */
  @Column({ type: 'varchar', length: 20, default: 'power' })
  kind!: 'power' | 'artifact';

  /** How an artifact looks, so every picture draws the same item. */
  @Column({ type: 'text', nullable: true })
  look!: string | null;

  @Column({ type: 'uuid', nullable: true })
  earnedInStoryId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Universe, (universe) => universe.powers, { onDelete: 'CASCADE' })
  universe!: Universe;
}

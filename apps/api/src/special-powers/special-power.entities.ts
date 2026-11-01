import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One special power hidden in every story on a given India day. */
@Entity('power_drops')
export class PowerDrop {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** India date, YYYY-MM-DD. One active drop per day. */
  @Index()
  @Column({ type: 'date' })
  day!: string;

  /** Power Book key (e.g. 'comet-shield'); null = an admin-written Bonus power that doesn't count towards levels. */
  @Column({ type: 'text', nullable: true })
  powerKey!: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  emoji!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/** A hero found that day's power (once per hero per drop). */
@Entity('power_finds')
@Index(['dropId', 'heroId'], { unique: true })
export class PowerFind {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  dropId!: string;

  @Index()
  @Column({ type: 'uuid' })
  heroId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  storyId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

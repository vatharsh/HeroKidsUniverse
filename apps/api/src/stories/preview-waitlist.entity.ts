import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Parents who asked for their free preview story after the day's free-preview quota
 * (FREE_PREVIEW_DAILY_LIMIT) ran out. They're emailed when free stories open up again.
 */
@Entity('preview_waitlist')
export class PreviewWaitlist {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  /** When we emailed them that free stories are available again. */
  @Column({ type: 'timestamp', nullable: true })
  notifiedAt!: Date | null;
}

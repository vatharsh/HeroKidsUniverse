import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type SupportReason = 'credits_missing' | 'charged_twice' | 'story_wrong' | 'other';
export type SupportStatus = 'open' | 'credited' | 'refunded' | 'declined' | 'resolved';

/** A parent's "need help" request about an order or a story (refunds, missing credits, a story that came out wrong). */
@Entity('support_requests')
@Index(['status', 'createdAt'])
export class SupportRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  storyId!: string | null;

  @Column({ type: 'text' })
  reason!: SupportReason;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'text', default: 'open' })
  status!: SupportStatus;

  /** What we told the parent when closing it. */
  @Column({ type: 'text', nullable: true })
  adminReply!: string | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  isSandbox!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../merchandise/soft-delete-columns';

export enum CommissionStatus {
  Pending = 'pending',
  Approved = 'approved',
  Paid = 'paid',
  Cancelled = 'cancelled',
  Reversed = 'reversed',
}

@Entity('influencer_commissions')
export class InfluencerCommission extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  influencerId!: string;

  @Column({ type: 'uuid' })
  couponCodeId!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @Column({ type: 'text' })
  orderNumber!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotalAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  orderTotal!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  commissionableAmount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  commissionRate!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  commissionAmount!: number;

  @Column({ type: 'enum', enum: CommissionStatus, default: CommissionStatus.Approved })
  status!: CommissionStatus;

  @Column({ type: 'timestamp', nullable: true })
  earnedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  payoutId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

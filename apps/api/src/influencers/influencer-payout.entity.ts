import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../merchandise/soft-delete-columns';

export enum PayoutStatus {
  Draft = 'draft',
  Paid = 'paid',
  Cancelled = 'cancelled',
}

@Entity('influencer_payouts')
export class InfluencerPayout extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  influencerId!: string;

  @Column({ type: 'text', unique: true })
  payoutNumber!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'text', default: 'INR' })
  currency!: string;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.Draft })
  status!: PayoutStatus;

  @Column({ type: 'text', nullable: true })
  paymentMethod!: string | null;

  @Column({ type: 'text', nullable: true })
  paymentReference!: string | null;

  @Column({ type: 'text', nullable: true })
  paymentProofUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  paymentProofFileType!: string | null;

  @Column({ type: 'text', nullable: true })
  adminNote!: string | null;

  @Column({ type: 'uuid', nullable: true })
  paidByUserId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

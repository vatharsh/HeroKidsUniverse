import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../merchandise/soft-delete-columns';

@Entity('influencer_wallets')
export class InfluencerWallet extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  influencerId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pendingAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  approvedAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidAmountLifetime!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastPayoutAt!: Date | null;

  @Column({ type: 'text', default: 'INR' })
  currency!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

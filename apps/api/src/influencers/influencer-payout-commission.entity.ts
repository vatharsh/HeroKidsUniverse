import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('influencer_payout_commissions')
export class InfluencerPayoutCommission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  payoutId!: string;

  @Column({ type: 'uuid' })
  commissionId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

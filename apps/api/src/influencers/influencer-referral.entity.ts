import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('influencer_referrals')
export class InfluencerReferral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  influencerId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  revenueInr!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  commissionInr!: number;

  @Column({ type: 'boolean', default: false })
  commissionPaid!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}

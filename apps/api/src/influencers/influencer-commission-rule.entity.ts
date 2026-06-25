import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../merchandise/soft-delete-columns';

@Entity('influencer_commission_rules')
export class InfluencerCommissionRule extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  influencerId!: string | null;

  @Column({ type: 'int', default: 0 })
  minSuccessfulOrders!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  commissionRate!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

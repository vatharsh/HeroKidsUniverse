import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../merchandise/soft-delete-columns';
import { InfluencerCouponCode } from './influencer-coupon-code.entity';

export enum InfluencerStatus {
  Active = 'active',
  Inactive = 'inactive',
  Blocked = 'blocked',
}

@Entity('influencers')
export class Influencer extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', unique: true })
  code!: string;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  platform!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  socialHandle!: string | null;

  @Column({ type: 'uuid', unique: true, nullable: true })
  userId!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionPct!: number;

  @Column({ type: 'enum', enum: InfluencerStatus, default: InfluencerStatus.Active })
  status!: InfluencerStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  maxCommissionRate!: number | null;

  @Column({ type: 'text', nullable: true })
  paymentMethod!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  paymentDetailsJson!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @OneToMany(() => InfluencerCouponCode, (coupon) => coupon.influencer)
  couponCodes!: InfluencerCouponCode[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

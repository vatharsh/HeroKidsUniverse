import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../merchandise/soft-delete-columns';
import { Influencer } from './influencer.entity';

export enum CouponDiscountType {
  Percentage = 'percentage',
  FixedAmount = 'fixed_amount',
}

export enum CouponType {
  Influencer = 'influencer',
  Platform = 'platform',
}

@Entity('influencer_coupon_codes')
export class InfluencerCouponCode extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  influencerId!: string | null;

  @ManyToOne(() => Influencer, (influencer) => influencer.couponCodes, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'influencerId' })
  influencer!: Influencer | null;

  @Column({ type: 'enum', enum: CouponType, default: CouponType.Influencer })
  couponType!: CouponType;

  @Column({ type: 'text', unique: true })
  code!: string;

  @Column({ type: 'enum', enum: CouponDiscountType })
  discountType!: CouponDiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxDiscountAmount!: number | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startsAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  usageLimit!: number | null;

  @Column({ type: 'int', default: 0 })
  usageCount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minimumOrderAmount!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  appliesToProductIds!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  appliesToCategoryIds!: string[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

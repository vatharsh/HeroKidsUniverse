import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('coupon_usage_records')
@Unique(['orderId'])
@Index(['couponCodeId', 'userId'])
export class CouponUsageRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  couponCodeId!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

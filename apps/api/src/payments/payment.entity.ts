import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PaymentStatus {
  Created = 'created',
  Captured = 'captured',
  Failed = 'failed',
  Refunded = 'refunded',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ type: 'text' })
  razorpayOrderId!: string;

  @Column({ type: 'text', nullable: true })
  razorpayPaymentId!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountInr!: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.Created })
  status!: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  method!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../soft-delete-columns';

export enum OrderPaymentState {
  Pending = 'pending',
  Paid = 'paid',
  PartiallyPaid = 'partially_paid',
  Failed = 'failed',
  Refunded = 'refunded',
  PartiallyRefunded = 'partially_refunded',
}

@Entity('order_payment_summaries')
export class OrderPaymentSummary extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  orderId!: string;

  @Column({ type: 'enum', enum: OrderPaymentState })
  paymentStatus!: OrderPaymentState;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPaidAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalRefundedAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  outstandingAmount!: number;

  @Column({ type: 'text', default: 'INR' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  paymentMethodSummary!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

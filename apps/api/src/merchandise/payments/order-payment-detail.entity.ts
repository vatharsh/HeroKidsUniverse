import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { SoftDeleteColumns } from '../soft-delete-columns';

export enum OrderPaymentTransactionType {
  Payment = 'payment',
  Refund = 'refund',
  PartialRefund = 'partial_refund',
  Adjustment = 'adjustment',
}

@Entity('order_payment_details')
export class OrderPaymentDetail extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @Column({ type: 'uuid' })
  paymentSummaryId!: string;

  @Column({ type: 'enum', enum: OrderPaymentTransactionType })
  transactionType!: OrderPaymentTransactionType;

  @Column({ type: 'text' })
  paymentProvider!: string;

  @Column({ type: 'text' })
  paymentMethod!: string;

  @Column({ type: 'text', nullable: true })
  transactionId!: string | null;

  @Column({ type: 'text', nullable: true })
  providerReference!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'text', default: 'INR' })
  currency!: string;

  @Column({ type: 'text' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  rawResponseJson!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}

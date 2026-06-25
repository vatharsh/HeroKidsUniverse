import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { PaymentMethod } from '../order.entity';
import { SoftDeleteColumns } from '../soft-delete-columns';

export enum CommerceOrderType {
  Digital = 'digital',
  Physical = 'physical',
  Mixed = 'mixed',
}

export enum CommerceOrderStatus {
  PendingPayment = 'pending_payment',
  Paid = 'paid',
  Processing = 'processing',
  DigitalReady = 'digital_ready',
  PrintFileGenerated = 'print_file_generated',
  SentToPrint = 'sent_to_print',
  Printing = 'printing',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
  Failed = 'failed',
  Refunded = 'refunded',
}

@Entity('orders')
export class Order extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', unique: true })
  orderNumber!: string;

  @Column({ type: 'enum', enum: CommerceOrderType })
  orderType!: CommerceOrderType;

  @Column({ type: 'enum', enum: CommerceOrderStatus })
  status!: CommerceOrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotalAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount!: number;

  @Column({ type: 'text', nullable: true })
  couponCode!: string | null;

  @Column({ type: 'uuid', nullable: true })
  couponCodeId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  influencerId!: string | null;

  @Column({ type: 'text', nullable: true })
  couponType!: string | null;

  @Column({ type: 'text', nullable: true })
  couponDiscountType!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  couponDiscountValue!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  couponDiscountAmount!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  influencerCommissionRate!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  influencerCommissionAmount!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  shippingAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  @Column({ type: 'text', default: 'INR' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  customerName!: string | null;

  @Column({ type: 'text', nullable: true })
  customerEmail!: string | null;

  @Column({ type: 'text', nullable: true })
  customerPhone!: string | null;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod!: PaymentMethod | null;

  @Column({ type: 'text', nullable: true })
  shippingName!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingPhone!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingAddressLine1!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingAddressLine2!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingCity!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingState!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingPincode!: string | null;

  @Column({ type: 'text', nullable: true, default: 'India' })
  shippingCountry!: string | null;

  @Column({ type: 'text', nullable: true })
  trackingNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  trackingUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  adminNotes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from './soft-delete-columns';

export enum OrderStatus {
  PendingPayment = 'pending_payment',
  Paid = 'paid',
  DigitalReady = 'digital_ready',
  PrintFileGenerated = 'print_file_generated',
  SentToPrint = 'sent_to_print',
  Printing = 'printing',
  Pending = 'pending',
  Processing = 'processing',
  Printed = 'printed',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
  Failed = 'failed',
  Refunded = 'refunded',
}

export enum PaymentProvider {
  Manual = 'manual',
}

export enum PaymentMethod {
  Cash = 'cash',
  Card = 'card',
  Upi = 'upi',
}

export enum PaymentStatus {
  MockPaid = 'mock_paid',
  PendingManual = 'pending_manual',
}

export enum FulfillmentType {
  Digital = 'digital',
  Physical = 'physical',
}

export enum ProductType {
  Poster = 'poster',
  Certificate = 'certificate',
  StickerSheet = 'sticker_sheet',
  Book = 'book',
  Video = 'video',
}

@Entity('merchandise_orders')
export class MerchandiseOrder extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  designId!: string | null;

  @Column({ type: 'text', nullable: true })
  productId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  storyId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  heroId!: string | null;

  @Column({ type: 'enum', enum: ProductType })
  productType!: ProductType;

  @Column({ type: 'enum', enum: FulfillmentType, default: FulfillmentType.Digital })
  fulfillmentType!: FulfillmentType;

  @Column({ type: 'text' })
  productName!: string;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountInr!: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PendingPayment })
  status!: OrderStatus;

  @Column({ type: 'enum', enum: PaymentProvider, default: PaymentProvider.Manual })
  paymentProvider!: PaymentProvider;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod!: PaymentMethod | null;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.MockPaid })
  paymentStatus!: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  customerName!: string | null;

  @Column({ type: 'text', nullable: true })
  customerEmail!: string | null;

  @Column({ type: 'text', nullable: true })
  customerPhone!: string | null;

  @Column({ type: 'text', nullable: true })
  trackingNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  trackingUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  printFileUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  downloadUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  razorpayOrderId!: string | null;

  @Column({ type: 'text', nullable: true })
  razorpayPaymentId!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingName!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingAddressLine2!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingCity!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingState!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingPincode!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingCountry!: string | null;

  @Column({ type: 'text', nullable: true })
  shippingPhone!: string | null;

  @Column({ type: 'text', nullable: true })
  adminNotes!: string | null;

  @Column({ type: 'boolean', default: false })
  isSandbox!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

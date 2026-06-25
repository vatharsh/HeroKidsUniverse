import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../soft-delete-columns';

@Entity('order_item_attribute_values')
export class OrderItemAttributeValue extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderItemAttributeId!: string;

  @Column({ type: 'text' })
  attributeValueSnapshot!: string;

  @Column({ type: 'text' })
  attributeLabelSnapshot!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceModifierSnapshot!: number;

  @Column({ type: 'jsonb', nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

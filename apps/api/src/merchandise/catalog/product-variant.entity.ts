import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../soft-delete-columns';

@Entity('product_variants')
export class ProductVariant extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  sku!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceModifier!: number;

  @Column({ type: 'int', nullable: true })
  stockQuantity!: number | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'jsonb', nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

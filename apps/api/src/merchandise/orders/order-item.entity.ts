import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../soft-delete-columns';

@Entity('order_items')
export class OrderItem extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @Column({ type: 'uuid', nullable: true })
  productId!: string | null;

  @Column({ type: 'text' })
  productNameSnapshot!: string;

  @Column({ type: 'text' })
  productSlugSnapshot!: string;

  @Column({ type: 'text', nullable: true })
  categoryNameSnapshot!: string | null;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice!: number;

  @Column({ type: 'uuid', nullable: true })
  designId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  heroId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  storyId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'text', nullable: true })
  previewUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  printFileUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

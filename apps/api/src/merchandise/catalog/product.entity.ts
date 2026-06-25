import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../soft-delete-columns';

export enum CatalogProductType {
  Digital = 'digital',
  Physical = 'physical',
}

@Entity('products')
export class Product extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  categoryId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: CatalogProductType })
  productType!: CatalogProductType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salePrice!: number | null;

  @Column({ type: 'text', nullable: true })
  previewImageUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  requiredAssetType!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../soft-delete-columns';

@Entity('merchandise_size_charts')
export class MerchandiseSizeChart extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'text' })
  sizeLabel!: string;

  @Column({ type: 'text', nullable: true })
  ageRange!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  chestInches!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  lengthInches!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  shoulderInches!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  chestCm!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  lengthCm!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  shoulderCm!: number | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

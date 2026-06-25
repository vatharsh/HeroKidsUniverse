import { CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Column } from 'typeorm';

import { SoftDeleteColumns } from '../soft-delete-columns';

@Entity('product_variant_attribute_values')
export class ProductVariantAttributeValue extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  variantId!: string;

  @Column({ type: 'uuid' })
  attributeValueId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

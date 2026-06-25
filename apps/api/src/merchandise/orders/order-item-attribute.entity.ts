import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SoftDeleteColumns } from '../soft-delete-columns';

@Entity('order_item_attributes')
export class OrderItemAttribute extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderItemId!: string;

  @Column({ type: 'text' })
  attributeNameSnapshot!: string;

  @Column({ type: 'text' })
  attributeSlugSnapshot!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

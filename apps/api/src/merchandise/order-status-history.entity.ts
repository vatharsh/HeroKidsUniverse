import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { SoftDeleteColumns } from './soft-delete-columns';

@Entity('order_status_history')
export class OrderStatusHistory extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @Column({ type: 'text', nullable: true })
  oldStatus!: string | null;

  @Column({ type: 'text' })
  newStatus!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'uuid', nullable: true })
  changedByUserId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

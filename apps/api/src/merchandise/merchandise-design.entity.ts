import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { FulfillmentType } from './order.entity';
import { SoftDeleteColumns } from './soft-delete-columns';

@Entity('merchandise_designs')
export class MerchandiseDesign extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  productId!: string;

  @Column({ type: 'text' })
  productName!: string;

  @Column({ type: 'enum', enum: FulfillmentType })
  fulfillmentType!: FulfillmentType;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  storyId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  heroId!: string | null;

  @Column({ type: 'text', nullable: true })
  displayName!: string | null;

  @Column({ type: 'text', nullable: true })
  titleText!: string | null;

  @Column({ type: 'text', nullable: true })
  subtitle!: string | null;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ type: 'text', nullable: true })
  themeColor!: string | null;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  data!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  previewUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

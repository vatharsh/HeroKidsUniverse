import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_addresses')
export class UserAddress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @Column({ type: 'text' })
  fullName!: string;

  @Column({ type: 'text' })
  phone!: string;

  @Column({ type: 'text' })
  addressLine1!: string;

  @Column({ type: 'text', nullable: true })
  addressLine2!: string | null;

  @Column({ type: 'text' })
  city!: string;

  @Column({ type: 'text' })
  state!: string;

  @Column({ type: 'text' })
  pincode!: string;

  @Column({ type: 'text', default: 'India' })
  country!: string;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deletedBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

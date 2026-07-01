import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_notification_preferences')
export class UserNotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'boolean', default: true })
  orderUpdates!: boolean;

  @Column({ type: 'boolean', default: true })
  storyUpdates!: boolean;

  @Column({ type: 'boolean', default: true })
  promotionalEmails!: boolean;

  @Column({ type: 'boolean', default: false })
  specialOffers!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

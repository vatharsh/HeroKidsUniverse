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

  /** Marketing email consent — opt-in only, so off until the parent turns it on. */
  @Column({ type: 'boolean', default: false })
  promotionalEmails!: boolean;

  @Column({ type: 'boolean', default: false })
  specialOffers!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

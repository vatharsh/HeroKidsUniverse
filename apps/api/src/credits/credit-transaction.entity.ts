import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { User } from '../users/user.entity';

export enum CreditTransactionReason {
  Purchase = 'purchase',
  StoryGeneration = 'story_generation',
  CharacterSlotUsed = 'character_slot_used',
  AvatarRefreshUsed = 'avatar_refresh_used',
  Refund = 'refund',
  ReferralBonus = 'referral_bonus',
  Demo = 'demo',
  Signup = 'signup',
}

@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int' })
  delta!: number;

  @Column({ type: 'enum', enum: CreditTransactionReason })
  reason!: CreditTransactionReason;

  @Column({ type: 'text', nullable: true })
  referenceId!: string | null;

  @Column({ type: 'int', default: 0 })
  bonusCredits!: number;

  @Column({ type: 'int', default: 0 })
  characterSlotsDelta!: number;

  @Column({ type: 'int', default: 0 })
  avatarRefreshTokensDelta!: number;

  @Column({ type: 'uuid', nullable: true })
  packId!: string | null;

  @Column({ type: 'text', nullable: true })
  packName!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pricePaid!: number | null;

  @Column({ type: 'text', nullable: true })
  razorpayOrderId!: string | null;

  @Column({ type: 'text', nullable: true })
  razorpayPaymentId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  user!: User;
}

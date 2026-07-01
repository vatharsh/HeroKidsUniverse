import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Character } from '../characters/entities/character.entity';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { Hero } from '../heroes/hero.entity';
import { Story } from '../stories/story.entity';

export enum UserRole {
  Parent = 'parent',
  Admin = 'admin',
  Influencer = 'influencer',
}

export enum UserPlan {
  Basic    = 'basic',
  Standard = 'standard',
  Premium  = 'premium',
}

export const PLAN_PAGE_COUNT: Record<UserPlan, number> = {
  [UserPlan.Basic]:    6,
  [UserPlan.Standard]: 8,
  [UserPlan.Premium]:  10,
};

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.Parent })
  role!: UserRole;

  @Column({ type: 'int', default: 0 })
  credits!: number;

  @Column({ type: 'int', default: 3 })
  characterSlotsTotal!: number;

  @Column({ type: 'int', default: 0 })
  characterSlotsUsed!: number;

  @Column({ type: 'int', default: 0 })
  avatarRefreshTokens!: number;

  @Column({ type: 'enum', enum: UserPlan, default: UserPlan.Basic })
  plan!: UserPlan;

  @Column({ type: 'boolean', default: false })
  isPremium!: boolean;

  @Column({ type: 'int', default: 0 })
  heroAvatarGenerationsUsed!: number;

  @Column({ type: 'int', default: 0 })
  characterAvatarGenerationsUsed!: number;

  @Column({ type: 'text', unique: true, nullable: true })
  referralCode!: string | null;

  @Column({ type: 'text', nullable: true })
  referredBy!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  profileImageUrl!: string | null;

  @Column({ type: 'boolean', default: false })
  isSandbox!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Hero, (hero) => hero.user)
  heroes!: Hero[];

  @OneToMany(() => Character, (character) => character.user)
  characters!: Character[];

  @OneToMany(() => Story, (story) => story.user)
  stories!: Story[];

  @OneToMany(() => CreditTransaction, (transaction) => transaction.user)
  orders!: CreditTransaction[];
}

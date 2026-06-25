import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PromotionType {
  Percentage = 'percentage',
  FlatAmount = 'flat_amount',
}

export enum CreditPackType {
  StoryCredits = 'story_credits',
  CharacterSlots = 'character_slots',
  AvatarRefreshes = 'avatar_refreshes',
}

@Entity('credit_packs')
export class CreditPack {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salePrice!: number | null;

  @Column({ type: 'text', default: 'INR' })
  currency!: string;

  @Column({ type: 'enum', enum: CreditPackType, default: CreditPackType.StoryCredits })
  packType!: CreditPackType;

  @Column({ type: 'int', default: 0 })
  credits!: number;

  @Column({ type: 'int', default: 0 })
  bonusCredits!: number;

  @Column({ type: 'int', default: 0 })
  characterSlots!: number;

  @Column({ type: 'int', default: 0 })
  avatarRefreshTokens!: number;

  @Column({ type: 'text', nullable: true })
  promotionName!: string | null;

  @Column({ type: 'enum', enum: PromotionType, nullable: true })
  promotionType!: PromotionType | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  promotionValue!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  promotionStart!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  promotionEnd!: Date | null;

  @Column({ type: 'text', nullable: true })
  badge!: string | null;

  @Column({ type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ type: 'boolean', default: false })
  isMostPopular!: boolean;

  @Column({ type: 'boolean', default: false })
  isBestValue!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  deletedBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

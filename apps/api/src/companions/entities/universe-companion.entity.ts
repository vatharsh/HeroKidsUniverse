import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum CompanionType {
  Dragon = 'Dragon',
  Phoenix = 'Phoenix',
  Robot = 'Robot',
  MagicalFox = 'MagicalFox',
  SpiritWolf = 'SpiritWolf',
  Unicorn = 'Unicorn',
  TransformedPet = 'TransformedPet',
  Other = 'Other',
}

@Entity('universe_companions')
export class UniverseCompanion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  universeId!: string;

  @Column({ nullable: true })
  petCharacterId?: string;

  @Column({ type: 'enum', enum: CompanionType })
  type!: CompanionType;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

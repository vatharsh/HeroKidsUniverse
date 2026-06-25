import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/user.entity';
import type { CharacterRole } from '../dto/create-character.dto';

@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'other' })
  role!: CharacterRole;

  @Column({ type: 'date', nullable: true })
  dob!: string | null;

  @Column({ type: 'text', nullable: true })
  photoUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.characters, { onDelete: 'CASCADE' })
  user!: User;
}

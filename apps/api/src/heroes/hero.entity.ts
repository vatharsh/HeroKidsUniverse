import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Story } from '../stories/story.entity';
import { User } from '../users/user.entity';

export enum HeroGender {
  Boy = 'boy',
  Girl = 'girl',
  NonBinary = 'non-binary',
}

@Entity('heroes')
export class Hero {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'date', default: () => "'2018-01-01'" })
  dob!: string;

  @Column({ type: 'enum', enum: HeroGender, nullable: true })
  gender!: HeroGender | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  characterSheetPrompt!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.heroes, { onDelete: 'CASCADE' })
  user!: User;

  @OneToMany(() => Story, (story) => story.hero)
  stories!: Story[];
}

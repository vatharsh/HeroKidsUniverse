import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('character_visual_profiles')
export class CharacterVisualProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  characterId!: string;

  @Column({ type: 'uuid', nullable: true })
  universeId!: string | null;

  @Column({ type: 'text', nullable: true })
  costumeDescription!: string | null;

  @Column({ type: 'text', nullable: true })
  hairDescription!: string | null;

  @Column({ type: 'text', nullable: true })
  faceDescription!: string | null;

  @Column({ type: 'text', nullable: true })
  skinTone!: string | null;

  @Column({ type: 'text', nullable: true })
  eyeDescription!: string | null;

  @Column({ type: 'text', nullable: true })
  accessories!: string | null;

  @Column({ type: 'text', nullable: true })
  colors!: string | null;

  @Column({ type: 'text', nullable: true })
  doNotChangeRules!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

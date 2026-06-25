import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('story_generation_logs')
export class StoryGenerationLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'text' })
  provider!: string;

  @Column({ type: 'text' })
  model!: string;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'text' })
  response!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

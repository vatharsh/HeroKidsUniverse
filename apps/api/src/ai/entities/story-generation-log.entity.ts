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

  @Column({ type: 'text', nullable: true })
  promptKey!: string | null;

  @Column({ type: 'uuid', nullable: true })
  promptTemplateId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  promptTemplateVersionId!: string | null;

  @Column({ type: 'text', nullable: true })
  promptVersion!: string | null;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'text' })
  response!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

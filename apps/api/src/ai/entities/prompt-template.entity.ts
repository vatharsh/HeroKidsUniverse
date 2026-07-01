import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { PromptTemplateVersion } from './prompt-template-version.entity';

export const PROMPT_TYPES = [
  'avatar_generation', 'avatar_regeneration', 'character_vision', 'character_canon',
  'story_generation', 'scene_generation', 'image_generation', 'narration', 'speech_bubble',
  'identity_qa', 'story_qa', 'expression_qa', 'dialogue_qa', 'composition_qa',
  'confidence_engine', 'merchandise_preview', 'companion_generation',
] as const;

@Entity('prompt_templates')
export class PromptTemplate {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) promptKey!: string;
  @Column() name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'text' }) promptType!: string;
  @Column({ type: 'text', nullable: true }) provider!: string | null;
  @Column({ type: 'text', nullable: true }) defaultModel!: string | null;
  @Column({ default: true }) isActive!: boolean;
  @Column({ default: false }) isSystemPrompt!: boolean;
  @Column({ default: false }) isDeleted!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) deletedBy!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @OneToMany(() => PromptTemplateVersion, (v) => v.promptTemplate, { cascade: false }) versions!: PromptTemplateVersion[];
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('prompt_run_snapshots')
export class PromptRunSnapshot {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) storyGenerationRunId!: string | null;
  @Column({ type: 'uuid', nullable: true }) storyId!: string | null;
  @Column({ type: 'uuid', nullable: true }) userId!: string | null;
  @Column({ type: 'uuid' }) promptTemplateId!: string;
  @Column({ type: 'uuid' }) promptTemplateVersionId!: string;
  @Column({ type: 'text' }) promptKey!: string;
  @Column({ type: 'text' }) version!: string;
  @Column({ type: 'text', nullable: true }) provider!: string | null;
  @Column({ type: 'text', nullable: true }) model!: string | null;
  @Column({ type: 'text' }) resolvedPromptText!: string;
  @Column({ type: 'jsonb', nullable: true }) resolvedVariablesJson!: object | null;
  @CreateDateColumn() createdAt!: Date;
}

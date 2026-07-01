import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { PromptTemplate } from './prompt-template.entity';

export type VersionStatus = 'draft' | 'active' | 'inactive' | 'archived';

@Entity('prompt_template_versions')
export class PromptTemplateVersion {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) promptTemplateId!: string;
  @ManyToOne(() => PromptTemplate, (t) => t.versions) @JoinColumn({ name: 'promptTemplateId' }) promptTemplate!: PromptTemplate;
  @Column({ type: 'text' }) version!: string;
  @Column({ type: 'text', nullable: true }) title!: string | null;
  @Column({ type: 'text' }) promptText!: string;
  @Column({ type: 'text', nullable: true }) systemInstructions!: string | null;
  @Column({ type: 'jsonb', nullable: true }) outputSchemaJson!: object | null;
  @Column({ type: 'jsonb', nullable: true }) variablesJson!: object | null;
  @Column({ type: 'text', nullable: true }) changeNotes!: string | null;
  @Column({ type: 'text', default: 'draft' }) status!: VersionStatus;
  @Column({ default: false }) isCurrent!: boolean;
  @Column({ type: 'uuid', nullable: true }) createdByUserId!: string | null;
  @Column({ type: 'uuid', nullable: true }) approvedByUserId!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) approvedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) activatedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) deactivatedAt!: Date | null;
  @Column({ default: false }) isDeleted!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) deletedBy!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

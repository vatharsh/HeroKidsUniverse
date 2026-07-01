import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('story_generation_costs')
export class StoryGenerationCost {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  storyId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  storyCostUsd!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  imageCostUsd!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  audioCostUsd!: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  videoCostUsd!: number;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  totalCostUsd!: number;

  @Column({ type: 'boolean', default: false })
  isSandbox!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}

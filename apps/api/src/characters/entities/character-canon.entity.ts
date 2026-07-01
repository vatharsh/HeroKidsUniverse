import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CanonType = 'hero' | 'supporting_character' | 'pet' | 'companion';
export type CanonStatus = 'pending' | 'complete' | 'failed' | 'needs_review';
export type CanonGeneratedFrom = 'approved_avatar' | 'manual_admin' | 'migration';

export interface CanonIdentityJson {
  approximate_age_range: string | null;
  gender_presentation_if_clear: string | null;
  skin_tone: string | null;
  face_shape: string | null;
  facial_proportions: string | null;
  eye_shape: string | null;
  eye_color_if_clear: string | null;
  eyebrow_shape: string | null;
  nose_shape: string | null;
  mouth_shape: string | null;
  smile_description: string | null;
  cheek_description: string | null;
  jawline_description: string | null;
  ear_visibility: string | null;
  hairstyle: string | null;
  hair_color: string | null;
  hair_length: string | null;
  hair_texture: string | null;
  build_visible: string | null;
  expression_default: string | null;
  glasses: boolean | null;
  facial_hair: boolean | null;
  jewellery: string | null;
  bindi: boolean | null;
  freckles: boolean | null;
  moles: string | null;
  dimples: boolean | null;
  braces: boolean | null;
  other_distinctive_features: string[];
  visual_rules: {
    must_preserve: string[];
    must_not_add: string[];
    must_not_change: string[];
    acceptable_variations: string[];
  };
}

export interface FaceMetricsJson {
  face_width_category: 'narrow' | 'medium' | 'wide' | null;
  face_length_category: 'short' | 'medium' | 'long' | null;
  eye_size_category: 'small' | 'medium' | 'large' | null;
  eye_spacing_category: 'close' | 'medium' | 'wide' | null;
  nose_size_category: 'small' | 'medium' | 'large' | null;
  mouth_width_category: 'narrow' | 'medium' | 'wide' | null;
  cheek_fullness_category: 'flat' | 'medium' | 'full' | null;
  chin_shape: 'round' | 'square' | 'pointed' | 'soft' | null;
  forehead_visibility: 'hidden' | 'partial' | 'full' | null;
  overall_face_silhouette: 'round' | 'oval' | 'heart' | 'square' | 'long' | null;
}

@Entity('character_canons')
export class CharacterCanon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  heroId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  characterId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  companionId!: string | null;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  canonType!: CanonType;

  @Column({ type: 'text', nullable: true })
  approvedAvatarUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  identityJson!: CanonIdentityJson | null;

  @Column({ type: 'text', nullable: true })
  appearanceSummary!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  neverChangeRulesJson!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  distinctiveFeaturesJson!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  faceMetricsJson!: FaceMetricsJson | null;

  @Column({ type: 'int', nullable: true })
  qualityScore!: number | null;

  @Column({ type: 'text', default: 'pending' })
  status!: CanonStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'text', default: 'approved_avatar' })
  generatedFrom!: CanonGeneratedFrom;

  @Column({ type: 'text', nullable: true })
  generationModel!: string | null;

  @Column({ type: 'int', default: 1 })
  generationVersion!: number;

  @Column({ type: 'float', nullable: true })
  identityStability!: number | null;

  @Column({ type: 'float', nullable: true })
  storyConsistency!: number | null;

  @Column({ type: 'float', nullable: true })
  characterConfidence!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;
}

import { Column } from 'typeorm';

export abstract class SoftDeleteColumns {
  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deletedBy!: string | null;
}

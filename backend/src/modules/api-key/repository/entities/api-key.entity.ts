import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Entidad de persistencia. Vive SOLO en la capa de repositorio; el Service nunca
 * la ve. El mapeo desde/hacia el dominio lo hace ApiKeyMapper.
 *
 * El índice parcial único garantiza a nivel de base de datos que cada usuario
 * tenga como máximo una fila activa (revoked_at IS NULL), incluso ante
 * emisiones concurrentes (spec, edge case de carreras).
 */
@Entity('api_keys')
@Index('idx_api_keys_active_user', ['userId'], {
  unique: true,
  where: 'revoked_at IS NULL',
})
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index({ unique: true })
  @Column({ name: 'key_hash', type: 'varchar', length: 64 })
  keyHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}

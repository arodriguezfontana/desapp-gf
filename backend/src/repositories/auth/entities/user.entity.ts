import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Entidad de persistencia. Vive SOLO en la capa de repositorio; el Service nunca
 * la ve. El mapeo desde/hacia el dominio lo hace UserMapper.
 */
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 60 })
  passwordHash!: string;

  /**
   * Requerido, sin indice unico (020-order-matching-engine, spec FR-001/FR-003):
   * dos usuarios distintos pueden compartir el mismo username. La unicidad del
   * unico valor reservado ("superuser") se garantiza por aplicacion, no por
   * constraint de esquema (research.md D2).
   */
  @Column({ type: 'varchar', length: 255, default: '' })
  username!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Mismo tipo y default que la migration `AddRoleToUsersAndApiKeys` (spec 008). */
  @Column({ type: 'varchar', length: 16, default: 'user' })
  role!: string;
}

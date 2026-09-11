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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

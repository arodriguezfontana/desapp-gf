import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Entidad de persistencia para PlayerQuote.
 * El mapeo dominio ↔ persistencia lo hace PlayerQuoteMapper.
 * Tabla: player_quotes (012-valuation-strategies, 019-per-user-valuation-strategies, data-model.md).
 *
 * weightSnapshot y factorEscalaSnapshot garantizan reproducibilidad histórica
 * independientemente de cambios futuros a la estrategia (spec DD-001).
 */
@Entity('player_quotes')
@Index(['userId', 'playerId', 'calculatedAt'])
export class PlayerQuoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @Column({ name: 'strategy_id', type: 'uuid' })
  strategyId!: string;

  @Column({ name: 'weight_snapshot', type: 'jsonb' })
  weightSnapshot!: Record<string, number>;

  @Column({ name: 'factor_escala_snapshot', type: 'decimal', precision: 10, scale: 4 })
  factorEscalaSnapshot!: string;

  @Column({ type: 'decimal', precision: 8, scale: 6 })
  score!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value!: string;

  @Column({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt!: Date;

  @Column({ name: 'applied_position', type: 'varchar', length: 2, nullable: true })
  appliedPosition!: string | null;
}

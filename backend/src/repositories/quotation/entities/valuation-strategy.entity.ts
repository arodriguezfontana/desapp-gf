import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Entidad de persistencia para ValuationStrategy.
 * El mapeo dominio ↔ persistencia lo hace ValuationStrategyMapper.
 * Tabla: valuation_strategies (012-valuation-strategies, 019-per-user-valuation-strategies, data-model.md).
 */
@Entity('valuation_strategies')
@Index(['userId'])
export class ValuationStrategyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'jsonb' })
  weights!: Record<string, number>;

  @Column({ name: 'position_weights', type: 'jsonb', nullable: true })
  positionWeights!: Record<string, Record<string, number>> | null;

  @Column({ name: 'factor_escala', type: 'decimal', precision: 10, scale: 4 })
  factorEscala!: string;

  @Column({ name: 'is_selected', type: 'boolean', default: false })
  isSelected!: boolean;

  /** Método de cálculo (ValuationMethod, spec 027). Las filas previas quedan en WEIGHTED. */
  @Column({ name: 'valuation_method', type: 'varchar', length: 20, default: 'WEIGHTED' })
  valuationMethod!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

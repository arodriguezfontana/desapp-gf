import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Entidad de persistencia para ValuationStrategy.
 * El mapeo dominio ↔ persistencia lo hace ValuationStrategyMapper.
 * Tabla: valuation_strategies (012-valuation-strategies, data-model.md).
 */
@Entity('valuation_strategies')
export class ValuationStrategyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'jsonb' })
  weights!: Record<string, number>;

  @Column({ name: 'factor_escala', type: 'decimal', precision: 10, scale: 4 })
  factorEscala!: string;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

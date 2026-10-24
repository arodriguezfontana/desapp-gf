import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Entidad de persistencia para PriceAlert (025-player-price-alerts,
 * data-model.md). Vive solo en la capa de repositorio; el mapeo lo hace
 * PriceAlertMapper.
 */
@Entity('price_alerts')
@Index('idx_price_alerts_user_player_status', ['userId', 'playerId', 'status'])
export class PriceAlertEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @Column({ type: 'varchar', length: 16 })
  condition!: string;

  @Column({ name: 'target_value', type: 'decimal', precision: 10, scale: 2 })
  targetValue!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;
}

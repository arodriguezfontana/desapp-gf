import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Entidad de persistencia para Notification (025-player-price-alerts,
 * data-model.md). Vive solo en la capa de repositorio; el mapeo lo hace
 * NotificationMapper.
 */
@Entity('notifications')
@Index('idx_notifications_user_created_at', ['userId', 'createdAt'])
export class NotificationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'alert_id', type: 'uuid' })
  alertId!: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @Column({ type: 'varchar', length: 16 })
  condition!: string;

  @Column({ name: 'triggered_value', type: 'decimal', precision: 10, scale: 2 })
  triggeredValue!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'boolean', default: false })
  read!: boolean;
}

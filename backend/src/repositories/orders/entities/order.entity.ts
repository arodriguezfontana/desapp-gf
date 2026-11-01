import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Entidad de persistencia para Order (020-order-matching-engine,
 * data-model.md). Vive SOLO en la capa de repositorio; el Service nunca la
 * ve. El mapeo desde/hacia el dominio lo hace OrderMapper.
 *
 * `status` se persiste como columna propia (aunque el dominio lo deriva
 * siempre de `remainingQuantity` vs `quantity`) porque es parte del indice
 * compuesto que resuelve exactamente la busqueda de candidatas del matching
 * (mismo jugador, lado opuesto, precio cruzado, status pendiente, mejor
 * precio primero y FIFO por created_at).
 */
@Entity('orders')
@Index('idx_orders_matching', ['playerId', 'side', 'price', 'status', 'createdAt'])
export class OrderEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @Column({ type: 'varchar', length: 4 })
  side!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ name: 'remaining_quantity', type: 'integer' })
  remainingQuantity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

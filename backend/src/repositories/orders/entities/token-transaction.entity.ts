import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Entidad de persistencia para TokenTransaction (020-order-matching-engine,
 * data-model.md). Tabla append-only: ningun repositorio expone update/delete
 * sobre ella (constitucion, Principio V). Vive SOLO en la capa de
 * repositorio; el mapeo lo hace TokenTransactionMapper.
 */
@Entity('token_transactions')
@Index(['userId', 'playerId', 'createdAt'])
export class TokenTransactionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 6 })
  type!: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'counterpart_order_id', type: 'uuid' })
  counterpartOrderId!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

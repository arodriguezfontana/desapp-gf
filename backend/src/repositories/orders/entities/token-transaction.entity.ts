import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Entidad de persistencia para TokenTransaction (020-order-matching-engine,
 * data-model.md). Tabla append-only: ningun repositorio expone update/delete
 * sobre ella (constitucion, Principio V). Vive SOLO en la capa de
 * repositorio; el mapeo lo hace TokenTransactionMapper.
 *
 * 030-token-balance-snapshot: `balance_before`/`balance_after` guardan el saldo de la
 * tenencia antes y despues del movimiento y son obligatorios (paso 2: los asientos anteriores se
 * completaron con `pnpm db:backfill-token-balances` y la migracion `EnforceTokenTransactionBalances`
 * los vuelve `NOT NULL` en produccion; en desarrollo y tests `synchronize` toma esta entidad).
 * `order_id`/`counterpart_order_id` son nulos solo en el asiento de emision inicial.
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

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ name: 'counterpart_order_id', type: 'uuid', nullable: true })
  counterpartOrderId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'balance_before', type: 'integer' })
  balanceBefore!: number;

  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter!: number;
}

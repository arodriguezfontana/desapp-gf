import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Entidad de persistencia para TokenHolding (020-order-matching-engine,
 * data-model.md — construye desde cero la infraestructura de 017-buy-tokens,
 * ver research.md D7). Existe como maximo una fila por par (user_id,
 * player_id): indice unico compuesto, un credito/debito es un upsert.
 */
@Entity('token_holdings')
@Index('idx_token_holdings_user_player', ['userId', 'playerId'], { unique: true })
export class TokenHoldingEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @Column({ type: 'integer', default: 0 })
  quantity!: number;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

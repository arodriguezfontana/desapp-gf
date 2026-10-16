import { TokenHolding } from '../../domain/portfolio/token-holding';
import { Transaction } from '../shared/transaction';

/**
 * Puerto de dominio para la persistencia de TokenHolding
 * (020-order-matching-engine). Token: TOKEN_HOLDING_REPOSITORY.
 */
export interface TokenHoldingRepository {
  findByUserId(userId: string): Promise<TokenHolding[]>;
  findByUserAndPlayer(userId: string, playerId: string): Promise<TokenHolding | null>;

  /** Insert o update simple, sin transaccion (p. ej. el seed del superusuario). */
  save(holding: TokenHolding): Promise<TokenHolding>;

  /**
   * Dentro de una `Transaction` ya abierta: lockea (`pessimistic_write`) el
   * holding de (userId, playerId), creandolo en 0 primero si todavia no
   * existia (bootstrap resuelto con `ON CONFLICT DO NOTHING` + re-select con
   * lock, para que una carrera entre dos transacciones concurrentes creando
   * el mismo holding por primera vez no falle). research.md D4: SIEMPRE
   * invocar en orden de `userId` ascendente cuando se lockean 2+ holdings en
   * la misma transaccion, para evitar deadlocks.
   */
  lockForUpdate(tx: Transaction, userId: string, playerId: string): Promise<TokenHolding>;

  /** Persiste (insert o update) dentro de una `Transaction` ya abierta. */
  saveInTransaction(tx: Transaction, holding: TokenHolding): Promise<TokenHolding>;
}

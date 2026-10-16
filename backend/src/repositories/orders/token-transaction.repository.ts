import { TokenTransaction } from '../../domain/orders/token-transaction';
import { Transaction } from '../shared/transaction';

/**
 * Puerto de dominio para la persistencia de TokenTransaction
 * (020-order-matching-engine). Append-only (constitucion, Principio V):
 * deliberadamente no expone ningun metodo de update ni delete. Token:
 * TOKEN_TRANSACTION_REPOSITORY.
 */
export interface TokenTransactionRepository {
  /** Insert simple, sin transaccion. */
  save(transaction: TokenTransaction): Promise<TokenTransaction>;

  /** Insert dentro de una `Transaction` ya abierta (usado por el matching). */
  saveInTransaction(tx: Transaction, transaction: TokenTransaction): Promise<TokenTransaction>;
}

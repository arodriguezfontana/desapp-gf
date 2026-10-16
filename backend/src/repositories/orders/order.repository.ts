import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/order-side';
import { Transaction } from '../shared/transaction';

/**
 * Puerto de dominio para la persistencia de Order (020-order-matching-engine).
 * Recibe y devuelve objetos de dominio; el Service nunca ve la entidad de
 * TypeORM. Token: ORDER_REPOSITORY.
 */
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;

  /**
   * Ordenes PENDING/PARTIALLY_FILLED del lado opuesto, mismo jugador, mismo
   * precio exacto, ordenadas FIFO por `(createdAt, id)` ascendente. Lectura
   * simple sin lock (usada fuera del flujo de matching transaccional).
   */
  findCompatibleCandidates(playerId: string, side: OrderSide, price: number): Promise<Order[]>;

  /** Insert o update simple, sin transaccion (p. ej. el seed del superusuario). */
  save(order: Order): Promise<Order>;

  /**
   * Dentro de una `Transaction` ya abierta: lockea (`pessimistic_write`) y
   * devuelve las ordenes PENDING/PARTIALLY_FILLED candidatas (lado opuesto,
   * mismo jugador, mismo precio exacto), ordenadas FIFO por
   * `(createdAt, id)` ascendente (research.md D4; spec FR-011, FR-012,
   * FR-021). Es el primer lock que se adquiere en el motor de matching.
   */
  lockCompatibleCandidates(
    tx: Transaction,
    playerId: string,
    side: OrderSide,
    price: number,
  ): Promise<Order[]>;

  /** Persiste (insert o update) dentro de una `Transaction` ya abierta. */
  saveInTransaction(tx: Transaction, order: Order): Promise<Order>;
}

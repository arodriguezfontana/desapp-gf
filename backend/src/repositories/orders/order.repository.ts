import { Order } from '../../domain/orders/order';
import { OrderBook } from '../../domain/orders/order-book';
import { OrderSide } from '../../domain/orders/order-side';
import { Transaction } from '../shared/transaction';

/**
 * Puerto de dominio para la persistencia de Order (020-order-matching-engine, 023-cancel-order).
 * Recibe y devuelve objetos de dominio; el Service nunca ve la entidad de
 * TypeORM. Token: ORDER_REPOSITORY.
 */
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;

  /**
   * Busca todas las órdenes emitidas por un usuario ordenadas cronológicamente
   * en forma descendente (createdAt DESC).
   */
  findByUserId(userId: string): Promise<Order[]>;

  /**
   * Ordenes PENDING/PARTIALLY_FILLED del lado opuesto, mismo jugador, mismo
   * precio exacto, ordenadas FIFO por `(createdAt, id)` ascendente. Lectura
   * simple sin lock (usada fuera del flujo de matching transaccional).
   */
  findCompatibleCandidates(playerId: string, side: OrderSide, price: number, excludeUserId: string): Promise<Order[]>;

  /**
   * Suma de `remainingQuantity` de todas las órdenes SELL abiertas
   * (PENDING + PARTIALLY_FILLED) del usuario para ese jugador. Usado para
   * detectar overselling: un SELL nuevo solo es válido si
   * `holding.quantity >= quantity + pendingSellQuantity`.
   */
  sumPendingSellQuantity(userId: string, playerId: string): Promise<number>;

  /** Insert o update simple, sin transaccion (p. ej. el seed del superusuario). */
  save(order: Order): Promise<Order>;

  /**
   * Dentro de una `Transaction` ya abierta: lockea (`pessimistic_write`) y
   * devuelve la orden por id para garantizar exclusión mutua contra matching (023-cancel-order).
   */
  findByIdWithLock(tx: Transaction, id: string): Promise<Order | null>;

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
    excludeUserId: string,
  ): Promise<Order[]>;

  /** Persiste (insert o update) dentro de una `Transaction` ya abierta. */
  saveInTransaction(tx: Transaction, order: Order): Promise<Order>;

  /**
   * Obtiene la instantánea agregada del libro de órdenes activas (PENDING y
   * PARTIALLY_FILLED) para un jugador, agrupadas por lado y precio (024-player-order-book).
   */
  getOrderBook(playerId: string): Promise<OrderBook>;
}

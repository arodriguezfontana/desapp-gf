import { Inject, Injectable, Logger } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { IdGenerator } from '../../adapters/runtime/id-generator';
import { CLOCK, ID_GENERATOR } from '../../modules/runtime/runtime.constants';


import { Order } from '../../domain/orders/order';
import { OrderBook } from '../../domain/orders/order-book';
import { oppositeSide, OrderSide } from '../../domain/orders/order-side';
import { TokenTransaction } from '../../domain/orders/token-transaction';
import { matchOrder } from '../../domain/orders/match-order';
import { involvedUserIdsInLockOrder, settleFills } from '../../domain/orders/settle-fills';
import { TokenHolding } from '../../domain/portfolio/token-holding';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import { OrderNotFoundError } from '../../domain/orders/errors/order-not-found.error';
import { OrderForbiddenError } from '../../domain/orders/errors/order-forbidden.error';
import { OrderNotCancellableError } from '../../domain/orders/errors/order-not-cancellable.error';

import { OrderRepository } from '../../repositories/orders/order.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { TransactionManager } from '../../repositories/shared/transaction-manager';

import { QuotationService } from '../quotation/quotation.service';
import { roundToTwoDecimals } from '../../shared/numbers/round2';
import { WithPlayerName, withPlayerName } from '../../shared/with-player-name';

export interface OrderCreationResult {
  order: Order;
  fills: Array<{ counterpartOrderId: string; quantity: number; price: number }>;
}

/**
 * Orquesta la creacion y cancelacion de ordenes y el motor de matching
 * (020-order-matching-engine, 023-cancel-order). El algoritmo de matching en si (FIFO, fills
 * parciales, remanente) vive en el dominio puro (`matchOrder`); este
 * Service decide CUANDO invocarlo y es responsable de la mecanica de
 * persistencia transaccional (abrir la transaccion, pedir los locks en el
 * orden deterministico de research.md D4) a traves de los puertos de
 * Repository — nunca ve una entidad de TypeORM ni un mapper directamente
 * (constitucion, Principio I).
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly orders: OrderRepository,
    private readonly tokenTransactions: TokenTransactionRepository,
    private readonly holdings: TokenHoldingRepository,
    private readonly players: PlayerRepository,
    private readonly transactionManager: TransactionManager,
    private readonly quotation: QuotationService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Crea una orden (spec FR-008/FR-009) y ejecuta el matching contra el
   * libro dentro de una unica transaccion atomica (spec FR-011 a FR-021).
   * @throws PlayerNotFoundError si `playerId` no existe en el catalogo.
   * @throws InsufficientHoldingError si `side = SELL` y el holding del
   * usuario para ese jugador es menor a `quantity` (spec FR-010).
   */
  async createOrder(
    userId: string,
    playerId: string,
    side: OrderSide,
    quantity: number,
  ): Promise<OrderCreationResult> {
    const player = await this.players.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundError();
    }

    if (side === OrderSide.SELL) {
      const holding = await this.holdings.findByUserAndPlayer(userId, playerId);
      const pendingSell = await this.orders.sumPendingSellQuantity(userId, playerId);
      TokenHolding.assertCanSell(holding, quantity, pendingSell);
    }

    const valuation = await this.quotation.valuate(userId, playerId);
    const price = roundToTwoDecimals(valuation.value);

    const newOrder = Order.create({
      id: this.ids.generate(),
      userId,
      playerId,
      side,
      quantity,
      price,
      createdAt: this.clock.now(),
    });

    const plan = await this.transactionManager.run(async (tx) => {
      const candidates = await this.orders.lockCompatibleCandidates(
        tx,
        playerId,
        oppositeSide(side),
        price,
        userId,
      );

      const matchPlan = matchOrder(newOrder, candidates);

      // research.md D4: lockear TODOS los holdings involucrados (el propio +
      // el de cada contraparte efectivamente tocada) ordenados por userId
      // ascendente, antes de aplicar ningun credito/debito — asi dos
      // POST /orders concurrentes que afectan a los mismos dos usuarios en
      // direcciones opuestas nunca se deadlockean entre si.
      const lockedEntries = await Promise.all(
        involvedUserIdsInLockOrder(matchPlan.fills).map(
          async (uid) => [uid, await this.holdings.lockForUpdate(tx, uid, playerId)] as const,
        ),
      );
      const settledHoldings = settleFills(matchPlan.fills, new Map(lockedEntries));

      await Promise.all(
        Array.from(settledHoldings.values()).map((h) => this.holdings.saveInTransaction(tx, h)),
      );

      await Promise.all([
        ...matchPlan.updatedCandidates.map((c) => this.orders.saveInTransaction(tx, c)),
        this.orders.saveInTransaction(tx, matchPlan.newOrderFinal),
      ]);

      const executedAt = this.clock.now();
      await Promise.all(
        matchPlan.fills.flatMap((fill) => {
          this.logger.log(
            `Fill ejecutado: BUY ${fill.buyOrderId} x SELL ${fill.sellOrderId}, cantidad ${fill.quantity}, precio ${fill.price}`,
          );
          return TokenTransaction.pairFromFill(fill, playerId, executedAt, () => this.ids.generate()).map((entry) =>
            this.tokenTransactions.saveInTransaction(tx, entry),
          );
        }),
      );

      return matchPlan;
    });

    const fills = plan.fills.map((fill) => ({
      counterpartOrderId: fill.buyOrderId === newOrder.id ? fill.sellOrderId : fill.buyOrderId,
      quantity: fill.quantity,
      price: fill.price,
    }));

    return { order: plan.newOrderFinal, fills };
  }

  /**
   * Cancela una orden propia en estado PENDING o PARTIALLY_FILLED.
   * Ejecuta la operación dentro de una transacción con lock pesimista
   * para prevenir condiciones de carrera contra el motor de matching (023-cancel-order).
   * @throws OrderNotFoundError si `orderId` no existe.
   * @throws OrderForbiddenError si la orden pertenece a otro usuario.
   * @throws OrderNotCancellableError si ya está COMPLETED o CANCELLED.
   */
  async cancelOrder(orderId: string, requesterId: string): Promise<Order> {
    return this.transactionManager.run(async (tx) => {
      const order = await this.orders.findByIdWithLock(tx, orderId);
      if (!order) {
        throw new OrderNotFoundError(orderId);
      }
      if (order.userId !== requesterId) {
        throw new OrderForbiddenError();
      }
      if (!order.isCancellable) {
        throw new OrderNotCancellableError(order.status);
      }

      const cancelledOrder = order.cancel();
      await this.orders.saveInTransaction(tx, cancelledOrder);
      this.logger.log(`Orden cancelada con éxito: ${orderId} por usuario ${requesterId}`);
      return cancelledOrder;
    });
  }

  /**
   * Obtiene todas las órdenes emitidas por un usuario ordenadas por fecha descendente,
   * enriquecidas con el nombre del jugador correspondiente.
   */
  async getUserOrders(userId: string): Promise<Array<WithPlayerName<Order>>> {
    const orders = await this.orders.findByUserId(userId);
    if (orders.length === 0) return [];

    const nameMap = await this.loadPlayerNames();
    return orders.map((o) => withPlayerName(o, nameMap.get(o.playerId) ?? ''));
  }

  async getHistory(userId: string): Promise<Array<WithPlayerName<TokenTransaction>>> {
    const transactions = await this.tokenTransactions.findByUserId(userId);
    if (transactions.length === 0) return [];

    const nameMap = await this.loadPlayerNames();
    return transactions.map((tx) => withPlayerName(tx, nameMap.get(tx.playerId) ?? tx.playerId));
  }

  private async loadPlayerNames(): Promise<Map<string, string>> {
    const allPlayers = await this.players.findAllActive();
    return new Map(allPlayers.map((p) => [p.id, p.name]));
  }

  /**
   * Obtiene la profundidad de mercado agregada para un jugador (024-player-order-book).
   * @throws PlayerNotFoundError si el jugador no existe.
   */
  async getOrderBook(playerId: string): Promise<OrderBook> {
    const player = await this.players.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    return this.orders.getOrderBook(playerId);
  }
}

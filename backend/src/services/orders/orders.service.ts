import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ORDER_REPOSITORY, TOKEN_TRANSACTION_REPOSITORY, TRANSACTION_MANAGER } from '../../modules/orders/orders.constants';
import { TOKEN_HOLDING_REPOSITORY } from '../../modules/portfolio/portfolio.constants';
import { PLAYER_REPOSITORY } from '../../modules/player/player.constants';

import { Order } from '../../domain/orders/order';
import { OrderBook } from '../../domain/orders/order-book';
import { oppositeSide, OrderSide } from '../../domain/orders/order-side';
import { TokenTransaction } from '../../domain/orders/token-transaction';
import { TokenTransactionType } from '../../domain/orders/token-transaction-type';
import { matchOrder } from '../../domain/orders/match-order';
import { InsufficientHoldingError } from '../../domain/portfolio/errors/insufficient-holding.error';
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
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(TOKEN_TRANSACTION_REPOSITORY) private readonly tokenTransactions: TokenTransactionRepository,
    @Inject(TOKEN_HOLDING_REPOSITORY) private readonly holdings: TokenHoldingRepository,
    @Inject(PLAYER_REPOSITORY) private readonly players: PlayerRepository,
    @Inject(TRANSACTION_MANAGER) private readonly transactionManager: TransactionManager,
    private readonly quotation: QuotationService,
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
      if ((holding?.quantity ?? 0) < quantity + pendingSell) {
        throw new InsufficientHoldingError();
      }
    }

    const valuation = await this.quotation.valuate(userId, playerId);
    const price = roundToTwoDecimals(valuation.value);

    const newOrder = Order.create({
      id: randomUUID(),
      userId,
      playerId,
      side,
      quantity,
      price,
      createdAt: new Date(),
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
      const involvedUserIdSet = new Set<string>();
      for (const fill of matchPlan.fills) {
        involvedUserIdSet.add(fill.buyerUserId);
        involvedUserIdSet.add(fill.sellerUserId);
      }
      const involvedUserIds = Array.from(involvedUserIdSet).sort((a, b) => a.localeCompare(b));

      const lockedEntries = await Promise.all(
        involvedUserIds.map(async (uid) => [uid, await this.holdings.lockForUpdate(tx, uid, playerId)] as const),
      );
      const lockedHoldings = new Map<string, Awaited<ReturnType<typeof this.holdings.lockForUpdate>>>(lockedEntries);

      // Nota: si `buyerUserId === sellerUserId` (auto-match, spec Edge Cases —
      // "no se distingue si ambas puntas pertenecen al mismo usuario"), el
      // credito y el debito son sobre EL MISMO holding. Por eso cada
      // operacion se lee de `lockedHoldings` recien antes de aplicarse (no
      // antes), para que el debito parta del estado YA acreditado y el saldo
      // neto quede correcto (sin cambio, en el caso de auto-match).
      for (const fill of matchPlan.fills) {
        const buyerHolding = lockedHoldings.get(fill.buyerUserId)!;
        lockedHoldings.set(fill.buyerUserId, buyerHolding.credit(fill.quantity));

        const sellerHolding = lockedHoldings.get(fill.sellerUserId)!;
        lockedHoldings.set(fill.sellerUserId, sellerHolding.debit(fill.quantity));
      }

      await Promise.all(
        Array.from(lockedHoldings.values()).map((h) => this.holdings.saveInTransaction(tx, h)),
      );

      await Promise.all([
        ...matchPlan.updatedCandidates.map((c) => this.orders.saveInTransaction(tx, c)),
        this.orders.saveInTransaction(tx, matchPlan.newOrderFinal),
      ]);

      const executedAt = new Date();
      await Promise.all(
        matchPlan.fills.flatMap((fill) => {
          this.logger.log(
            `Fill ejecutado: BUY ${fill.buyOrderId} x SELL ${fill.sellOrderId}, cantidad ${fill.quantity}, precio ${fill.price}`,
          );
          return [
            this.tokenTransactions.saveInTransaction(
              tx,
              TokenTransaction.create({
                id: randomUUID(),
                userId: fill.buyerUserId,
                type: TokenTransactionType.CREDIT,
                playerId,
                quantity: fill.quantity,
                price: fill.price,
                orderId: fill.buyOrderId,
                counterpartOrderId: fill.sellOrderId,
                createdAt: executedAt,
              }),
            ),
            this.tokenTransactions.saveInTransaction(
              tx,
              TokenTransaction.create({
                id: randomUUID(),
                userId: fill.sellerUserId,
                type: TokenTransactionType.DEBIT,
                playerId,
                quantity: fill.quantity,
                price: fill.price,
                orderId: fill.sellOrderId,
                counterpartOrderId: fill.buyOrderId,
                createdAt: executedAt,
              }),
            ),
          ];
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
  async getUserOrders(userId: string): Promise<Array<Order & { playerName: string }>> {
    const orders = await this.orders.findByUserId(userId);
    if (orders.length === 0) return [];

    const allPlayers = await this.players.findAllActive();
    const nameMap = new Map(allPlayers.map((p) => [p.id, p.name]));
    return orders.map((o) => Object.assign(o, { playerName: nameMap.get(o.playerId) ?? '' }));
  }

  async getHistory(userId: string): Promise<Array<TokenTransaction & { playerName: string }>> {
    const transactions = await this.tokenTransactions.findByUserId(userId);
    if (transactions.length === 0) return [];

    const allPlayers = await this.players.findAllActive();
    const nameMap = new Map(allPlayers.map((p) => [p.id, p.name]));

    return transactions.map((tx) => Object.assign(tx, { playerName: nameMap.get(tx.playerId) ?? tx.playerId }));
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

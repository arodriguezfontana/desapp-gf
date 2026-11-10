import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/enums/order-side';
import { OrderStatus } from '../../domain/orders/enums/order-status';
import { TokenTransaction } from '../../domain/orders/token-transaction';
import { TokenTransactionType } from '../../domain/orders/enums/token-transaction-type';
import { PlayerQuote } from '../../domain/quotation/player-quote';
import { PriceAlert } from '../../domain/alerts/price-alert';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { Player } from '../../domain/player/player';
import { User } from '../../domain/auth/user';
import { roundToTwoDecimals } from '../../shared/numbers/round2';
import {
  ADMIN_ORDER_PLANS,
  BOT_INITIAL_HOLDING,
  buildTradePlans,
  DEMO_ALERT_ABOVE_FACTOR,
  DEMO_ALERT_BELOW_FACTOR,
  FALLBACK_REFERENCE_PRICE,
  MARKET_BOOK_LEVELS,
  QUOTE_HISTORY_STEPS,
} from './simulation-plans';
import { buildSimulationSnapshots, SimulatedMovement } from './simulation-balances';

/**
 * Constructores puros de los datos que siembra la simulación de mercado. Reciben las plantillas de
 * `simulation-plans.ts` y devuelven objetos de dominio listos para guardar: no tocan repositorios ni
 * Nest, así que se prueban sin mocks. `MarketSimulationService` solo decide el orden y persiste.
 *
 * Los ids se piden a `newId` en el mismo orden en que los pedía el service, para que la salida sea
 * determinista con un generador determinista.
 */

export type NewId = () => string;
export type DateAgo = (daysAgo: number) => Date;
export type ReferencePrices = ReadonlyMap<string, number>;

const priceOf = (refPrices: ReferencePrices, playerId: string): number =>
  refPrices.get(playerId) ?? FALLBACK_REFERENCE_PRICE;

/** Cantidad de una tenencia a fijar (la siembra la fija con `withQuantity`, no por crédito/débito). */
export interface SeededHolding {
  userId: string;
  playerId: string;
  quantity: number;
}

/**
 * Historial de operaciones ya ejecutadas entre el admin y los bots: para cada plan, la orden del admin,
 * la orden contraparte del bot y los dos asientos de auditoría (con su saldo antes/después), más la
 * tenencia final del admin por jugador (nunca negativa; solo las positivas se devuelven).
 */
export function buildTradeSeed(input: {
  adminId: string;
  bots: readonly User[];
  simPlayers: readonly Player[];
  refPrices: ReferencePrices;
  dateAgo: DateAgo;
  newId: NewId;
}): { orders: Order[]; transactions: TokenTransaction[]; adminHoldings: SeededHolding[] } {
  const { adminId, bots, simPlayers, refPrices, dateAgo, newId } = input;
  const orders: Order[] = [];
  const adminHoldingsQty = new Map<string, number>();
  const drafts: Array<Omit<Parameters<typeof TokenTransaction.create>[0], 'balanceBefore' | 'balanceAfter'>> = [];

  for (const plan of buildTradePlans(simPlayers.length)) {
    const player = simPlayers[plan.playerIdx];
    const bot = bots[plan.botIdx % bots.length];
    const price = roundToTwoDecimals(priceOf(refPrices, player.id) * plan.priceFactor);
    const createdAt = dateAgo(plan.daysAgo);
    const orderId = newId();
    const counterpartOrderId = newId();
    const adminSide = plan.type === TokenTransactionType.CREDIT ? OrderSide.BUY : OrderSide.SELL;
    const botSide = adminSide === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;

    orders.push(
      Order.seed({ id: orderId, userId: adminId, playerId: player.id, side: adminSide, quantity: plan.quantity, remainingQuantity: 0, price, createdAt, status: OrderStatus.COMPLETED }),
      Order.seed({ id: counterpartOrderId, userId: bot.id, playerId: player.id, side: botSide, quantity: plan.quantity, remainingQuantity: 0, price, createdAt, status: OrderStatus.COMPLETED }),
    );

    drafts.push({ id: newId(), userId: adminId, type: plan.type, playerId: player.id, quantity: plan.quantity, price, orderId, counterpartOrderId, createdAt });
    const botTxType = plan.type === TokenTransactionType.CREDIT ? TokenTransactionType.DEBIT : TokenTransactionType.CREDIT;
    drafts.push({ id: newId(), userId: bot.id, type: botTxType, playerId: player.id, quantity: plan.quantity, price, orderId: counterpartOrderId, counterpartOrderId: orderId, createdAt });

    const current = adminHoldingsQty.get(player.id) ?? 0;
    adminHoldingsQty.set(player.id, Math.max(0, plan.type === TokenTransactionType.CREDIT ? current + plan.quantity : current - plan.quantity));
  }

  // Saldo antes/después de cada asiento: el admin parte de 0 y cada bot de su tenencia inicial. La tenencia
  // final del bot la fija `buildMarketBook` en un valor absoluto y no se reconcilia con estos asientos: son datos de prueba.
  const movements: SimulatedMovement[] = drafts.map((d) => ({
    id: d.id, userId: d.userId, playerId: d.playerId, type: d.type, quantity: d.quantity, createdAt: d.createdAt,
  }));
  const botIds = new Set(bots.map((bot) => bot.id));
  const snapshots = buildSimulationSnapshots(movements, (userId) => (botIds.has(userId) ? BOT_INITIAL_HOLDING : 0));
  const transactions = drafts.map((draft) => {
    const snapshot = snapshots.get(draft.id)!;
    return TokenTransaction.create({ ...draft, balanceBefore: snapshot.before, balanceAfter: snapshot.after });
  });

  const adminHoldings = [...adminHoldingsQty.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([playerId, quantity]) => ({ userId: adminId, playerId, quantity }));

  return { orders, transactions, adminHoldings };
}

/** Órdenes propias del admin en distintos estados (`playerIdx` negativo cuenta desde el último jugador simulado). */
export function buildAdminOrders(input: {
  adminId: string;
  simPlayers: readonly Player[];
  refPrices: ReferencePrices;
  dateAgo: DateAgo;
  newId: NewId;
}): Order[] {
  const { adminId, simPlayers, refPrices, dateAgo, newId } = input;
  return ADMIN_ORDER_PLANS.map((plan) => {
    const player = plan.playerIdx < 0 ? simPlayers.at(plan.playerIdx)! : simPlayers[plan.playerIdx];
    return Order.seed({
      id: newId(),
      userId: adminId,
      playerId: player.id,
      side: plan.side,
      quantity: plan.quantity,
      remainingQuantity: plan.remainingQuantity,
      price: roundToTwoDecimals(priceOf(refPrices, player.id) * plan.priceFactor),
      createdAt: dateAgo(plan.daysAgo),
      status: plan.status,
    });
  });
}

/** Libro de órdenes abiertas de los bots y la tenencia inicial de cada bot por jugador. */
export function buildMarketBook(input: {
  bots: readonly User[];
  simPlayers: readonly Player[];
  refPrices: ReferencePrices;
  dateAgo: DateAgo;
  newId: NewId;
}): { orders: Order[]; botHoldings: SeededHolding[] } {
  const { bots, simPlayers, refPrices, dateAgo, newId } = input;
  const botHoldings = simPlayers.flatMap((player) =>
    bots.map((bot) => ({ userId: bot.id, playerId: player.id, quantity: BOT_INITIAL_HOLDING })),
  );
  const orders = simPlayers.flatMap((player) => {
    const base = priceOf(refPrices, player.id);
    return MARKET_BOOK_LEVELS.map((level) =>
      Order.seed({
        id: newId(),
        userId: bots[level.botIdx].id,
        playerId: player.id,
        side: level.side,
        quantity: level.quantity,
        remainingQuantity: level.quantity,
        price: roundToTwoDecimals(base * level.priceFactor),
        createdAt: dateAgo(level.daysAgo),
        status: OrderStatus.PENDING,
      }),
    );
  });
  return { orders, botHoldings };
}

/** Historial de cotizaciones del admin por jugador; `latest` es la última de cada jugador, en el mismo orden. */
export function buildQuoteHistory(input: {
  adminId: string;
  activePlayers: readonly Player[];
  refPrices: ReferencePrices;
  strategyId: string;
  dateAgo: DateAgo;
  newId: NewId;
}): { quotes: PlayerQuote[]; latest: PlayerQuote[] } {
  const { adminId, activePlayers, refPrices, strategyId, dateAgo, newId } = input;
  const quotes: PlayerQuote[] = [];
  const latest: PlayerQuote[] = [];
  for (const player of activePlayers) {
    const currentPrice = priceOf(refPrices, player.id);
    let last: PlayerQuote | null = null;
    for (const step of QUOTE_HISTORY_STEPS) {
      const quoteValue = roundToTwoDecimals(currentPrice * step.factor);
      const quote = PlayerQuote.create({ id: newId(), userId: adminId, playerId: player.id, strategyId, weightSnapshot: { rating: 1.0, goals: 1.0 }, factorEscalaSnapshot: 1.0, score: roundToTwoDecimals(quoteValue / 10), value: quoteValue, calculatedAt: dateAgo(step.daysAgo), appliedPosition: player.position });
      quotes.push(quote);
      last = quote;
    }
    latest.push(last!);
  }
  return { quotes, latest };
}

/**
 * Dos alertas de demo del admin: una `PRICE_BELOW` sobre el primer jugador y, si hay más de uno, una
 * `PRICE_ABOVE` sobre el segundo. Los umbrales salen de los precios de referencia con margen suficiente para
 * que la cotización simulada (≈0.99 × precio de referencia) las cumpla y dispare el flujo real de alertas.
 */
export function buildDemoAlerts(input: {
  adminId: string;
  simPlayers: readonly Player[];
  refPrices: ReferencePrices;
  now: Date;
  newId: NewId;
}): PriceAlert[] {
  const { adminId, simPlayers, refPrices, now, newId } = input;
  const alerts: PriceAlert[] = [];
  if (simPlayers.length === 0) return alerts;

  const belowPlayer = simPlayers[0];
  alerts.push(
    PriceAlert.create({
      id: newId(),
      userId: adminId,
      playerId: belowPlayer.id,
      condition: AlertCondition.PRICE_BELOW,
      targetValue: roundToTwoDecimals(priceOf(refPrices, belowPlayer.id) * DEMO_ALERT_BELOW_FACTOR),
      createdAt: now,
    }),
  );
  if (simPlayers.length > 1) {
    const abovePlayer = simPlayers[1];
    alerts.push(
      PriceAlert.create({
        id: newId(),
        userId: adminId,
        playerId: abovePlayer.id,
        condition: AlertCondition.PRICE_ABOVE,
        targetValue: roundToTwoDecimals(priceOf(refPrices, abovePlayer.id) * DEMO_ALERT_ABOVE_FACTOR),
        createdAt: now,
      }),
    );
  }
  return alerts;
}

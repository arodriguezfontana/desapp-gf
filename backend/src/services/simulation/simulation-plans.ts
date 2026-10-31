import { OrderSide } from '../../domain/orders/order-side';
import { OrderStatus } from '../../domain/orders/order-status';
import { TokenTransactionType } from '../../domain/orders/token-transaction-type';

/**
 * Datos de configuracion de la simulacion de mercado (admin). Son plantillas
 * puras y deterministas: dicen QUE sembrar (cuantos tokens, a que fraccion del
 * precio de referencia, hace cuantos dias), mientras que
 * `MarketSimulationService` decide COMO persistirlo.
 */

export interface BotConfig {
  email: string;
  username: string;
}

export const DEFAULT_BOTS: BotConfig[] = [
  { email: 'bot_liquidity_1@desapp.com', username: 'LiquidityBot' },
  { email: 'bot_trader_2@desapp.com', username: 'AlphaTraderBot' },
  { email: 'bot_whale_3@desapp.com', username: 'WhaleInvestorBot' },
];

/** Cantidad maxima de jugadores del catalogo que reciben actividad de mercado simulada. */
export const MAX_SIMULATED_PLAYERS = 6;

/** Precio de referencia cuando el jugador no se puede valuar. */
export const FALLBACK_REFERENCE_PRICE = 20;

/** Piso del precio de referencia valuado. */
export const MIN_REFERENCE_PRICE = 5;

/** Tokens con los que arranca cada bot por cada jugador simulado. */
export const BOT_INITIAL_HOLDING = 250;

/** Devuelve una funcion que da la fecha de hace N dias respecto de `now`. */
export function buildDateHelper(now: Date): (daysAgo: number) => Date {
  const dayMs = 24 * 60 * 60 * 1000;
  return (daysAgo: number) => new Date(now.getTime() - daysAgo * dayMs);
}

/** Operacion historica ya ejecutada entre el admin y un bot. */
export interface TradePlan {
  playerIdx: number;
  type: TokenTransactionType;
  quantity: number;
  priceFactor: number;
  daysAgo: number;
  botIdx: number;
}

/** Historial de operaciones del admin; los jugadores 4 y 5 solo existen si el catalogo los tiene. */
export function buildTradePlans(simulatedPlayerCount: number): TradePlan[] {
  const { CREDIT, DEBIT } = TokenTransactionType;
  const plans: TradePlan[] = [
    { playerIdx: 0, type: CREDIT, quantity: 30, priceFactor: 0.9, daysAgo: 13, botIdx: 0 },
    { playerIdx: 0, type: DEBIT, quantity: 10, priceFactor: 1.05, daysAgo: 4, botIdx: 1 },
    { playerIdx: 0, type: CREDIT, quantity: 5, priceFactor: 1.0, daysAgo: 0, botIdx: 2 },
    { playerIdx: 1, type: CREDIT, quantity: 40, priceFactor: 0.85, daysAgo: 11, botIdx: 1 },
    { playerIdx: 1, type: DEBIT, quantity: 10, priceFactor: 1.1, daysAgo: 6, botIdx: 0 },
    { playerIdx: 2, type: CREDIT, quantity: 25, priceFactor: 0.92, daysAgo: 9, botIdx: 0 },
    { playerIdx: 2, type: CREDIT, quantity: 15, priceFactor: 1.02, daysAgo: 3, botIdx: 2 },
    { playerIdx: 3, type: CREDIT, quantity: 35, priceFactor: 0.88, daysAgo: 8, botIdx: 2 },
    { playerIdx: 3, type: DEBIT, quantity: 10, priceFactor: 1.15, daysAgo: 2, botIdx: 1 },
  ];
  if (simulatedPlayerCount > 4) {
    plans.push(
      { playerIdx: 4, type: CREDIT, quantity: 20, priceFactor: 0.95, daysAgo: 5, botIdx: 0 },
      { playerIdx: 4, type: CREDIT, quantity: 10, priceFactor: 1.05, daysAgo: 1, botIdx: 1 },
    );
  }
  if (simulatedPlayerCount > 5) {
    plans.push({ playerIdx: 5, type: CREDIT, quantity: 15, priceFactor: 0.94, daysAgo: 7, botIdx: 2 });
  }
  return plans;
}

/** Orden propia del admin en distintos estados. `playerIdx: -1` es el ultimo jugador simulado. */
export interface AdminOrderPlan {
  playerIdx: number;
  side: OrderSide;
  quantity: number;
  remainingQuantity: number;
  priceFactor: number;
  daysAgo: number;
  status: OrderStatus;
}

export const ADMIN_ORDER_PLANS: AdminOrderPlan[] = [
  { playerIdx: -1, side: OrderSide.BUY, quantity: 15, remainingQuantity: 15, priceFactor: 0.95, daysAgo: 1, status: OrderStatus.PENDING },
  { playerIdx: 0, side: OrderSide.SELL, quantity: 10, remainingQuantity: 5, priceFactor: 1.12, daysAgo: 2, status: OrderStatus.PARTIALLY_FILLED },
  { playerIdx: 1, side: OrderSide.BUY, quantity: 40, remainingQuantity: 0, priceFactor: 0.85, daysAgo: 11, status: OrderStatus.COMPLETED },
  { playerIdx: 2, side: OrderSide.SELL, quantity: 10, remainingQuantity: 10, priceFactor: 1.3, daysAgo: 7, status: OrderStatus.CANCELLED },
];

/** Nivel del libro de ordenes que publica un bot por cada jugador simulado. */
export interface MarketBookLevel {
  botIdx: number;
  side: OrderSide;
  quantity: number;
  priceFactor: number;
  daysAgo: number;
}

export const MARKET_BOOK_LEVELS: MarketBookLevel[] = [
  { botIdx: 0, side: OrderSide.BUY, quantity: 20, priceFactor: 0.98, daysAgo: 3 },
  { botIdx: 1, side: OrderSide.BUY, quantity: 35, priceFactor: 0.95, daysAgo: 4 },
  { botIdx: 2, side: OrderSide.BUY, quantity: 50, priceFactor: 0.91, daysAgo: 5 },
  { botIdx: 0, side: OrderSide.SELL, quantity: 15, priceFactor: 1.02, daysAgo: 2 },
  { botIdx: 1, side: OrderSide.SELL, quantity: 30, priceFactor: 1.06, daysAgo: 3 },
  { botIdx: 2, side: OrderSide.SELL, quantity: 60, priceFactor: 1.1, daysAgo: 4 },
];

/** Puntos del historial de cotizaciones de respaldo (del mas antiguo al mas reciente). */
export const QUOTE_HISTORY_STEPS: Array<{ daysAgo: number; factor: number }> = [
  { daysAgo: 25, factor: 0.82 },
  { daysAgo: 20, factor: 0.87 },
  { daysAgo: 15, factor: 0.91 },
  { daysAgo: 10, factor: 0.96 },
  { daysAgo: 5, factor: 0.99 },
];

/** Umbrales de las alertas de demo, como fraccion del precio de referencia. */
export const DEMO_ALERT_BELOW_FACTOR = 1.05;
export const DEMO_ALERT_ABOVE_FACTOR = 0.9;

import { OrderStatus } from '../../domain/orders/order-status';
import { TokenTransactionType } from '../../domain/orders/token-transaction-type';
import {
  ADMIN_ORDER_PLANS,
  buildDateHelper,
  buildTradePlans,
  DEFAULT_BOTS,
  MARKET_BOOK_LEVELS,
  QUOTE_HISTORY_STEPS,
} from './simulation-plans';

describe('buildTradePlans', () => {
  it('con 4 jugadores simulados solo planifica operaciones para los jugadores 0 a 3', () => {
    const plans = buildTradePlans(4);
    expect(plans).toHaveLength(9);
    expect(Math.max(...plans.map((p) => p.playerIdx))).toBe(3);
  });

  it('con 5 jugadores agrega las operaciones del jugador 4', () => {
    const plans = buildTradePlans(5);
    expect(plans).toHaveLength(11);
    expect(plans.filter((p) => p.playerIdx === 4)).toHaveLength(2);
    expect(plans.some((p) => p.playerIdx === 5)).toBe(false);
  });

  it('con 6 jugadores agrega tambien la operacion del jugador 5', () => {
    const plans = buildTradePlans(6);
    expect(plans).toHaveLength(12);
    expect(plans.filter((p) => p.playerIdx === 5)).toHaveLength(1);
  });

  it('cada operacion apunta a un bot existente y nunca vende mas de lo comprado por jugador', () => {
    const plans = buildTradePlans(6);
    const netByPlayer = new Map<number, number>();
    for (const plan of plans) {
      expect(plan.botIdx).toBeLessThan(DEFAULT_BOTS.length);
      const delta = plan.type === TokenTransactionType.CREDIT ? plan.quantity : -plan.quantity;
      const net = (netByPlayer.get(plan.playerIdx) ?? 0) + delta;
      expect(net).toBeGreaterThanOrEqual(0);
      netByPlayer.set(plan.playerIdx, net);
    }
  });
});

describe('plantillas de simulacion', () => {
  it('las ordenes del admin cubren todos los estados y son coherentes con su cantidad restante', () => {
    expect(ADMIN_ORDER_PLANS.map((p) => p.status).sort((a, b) => a.localeCompare(b))).toEqual(
      [OrderStatus.CANCELLED, OrderStatus.COMPLETED, OrderStatus.PARTIALLY_FILLED, OrderStatus.PENDING].sort((a, b) =>
        a.localeCompare(b),
      ),
    );
    for (const plan of ADMIN_ORDER_PLANS) {
      expect(plan.remainingQuantity).toBeLessThanOrEqual(plan.quantity);
    }
  });

  it('el libro de mercado publica tres niveles BUY y tres SELL de bots existentes', () => {
    expect(MARKET_BOOK_LEVELS).toHaveLength(6);
    for (const level of MARKET_BOOK_LEVELS) {
      expect(level.botIdx).toBeLessThan(DEFAULT_BOTS.length);
    }
  });

  it('el historial de cotizaciones va del mas antiguo al mas reciente', () => {
    const days = QUOTE_HISTORY_STEPS.map((s) => s.daysAgo);
    expect(days).toEqual([...days].sort((a, b) => b - a));
  });
});

describe('buildDateHelper', () => {
  it('devuelve la fecha de hace N dias respecto del instante de creacion del helper', () => {
    const before = Date.now();
    const tDate = buildDateHelper();
    const dayMs = 24 * 60 * 60 * 1000;

    const threeDaysAgo = tDate(3).getTime();

    expect(threeDaysAgo).toBeLessThanOrEqual(before - 3 * dayMs + 1000);
    expect(threeDaysAgo).toBeGreaterThanOrEqual(before - 3 * dayMs - 1000);
    expect(tDate(0).getTime()).toBeGreaterThan(threeDaysAgo);
  });
});

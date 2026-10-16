import { Order } from './order';
import { OrderSide } from './order-side';
import { OrderStatus } from './order-status';
import { OrderOverfillError } from './errors/order-overfill.error';
import { InvalidOrderQuantityError } from './errors/invalid-order-quantity.error';

describe('Order', () => {
  const createdAt = new Date('2026-10-16T12:00:00.000Z');

  const build = (overrides: Partial<Parameters<typeof Order.create>[0]> = {}) =>
    Order.create({
      id: 'order-1',
      userId: 'user-1',
      playerId: 'player-1',
      side: OrderSide.BUY,
      quantity: 10,
      price: 12.5,
      createdAt,
      ...overrides,
    });

  describe('create', () => {
    it('nace con remainingQuantity = quantity y status PENDING', () => {
      const order = build();
      expect(order.remainingQuantity).toBe(10);
      expect(order.status).toBe(OrderStatus.PENDING);
    });

    it('rechaza cantidad no entera', () => {
      expect(() => build({ quantity: 1.5 })).toThrow(InvalidOrderQuantityError);
    });

    it('rechaza cantidad <= 0', () => {
      expect(() => build({ quantity: 0 })).toThrow(InvalidOrderQuantityError);
      expect(() => build({ quantity: -5 })).toThrow(InvalidOrderQuantityError);
    });
  });

  describe('fill', () => {
    it('decrementa remainingQuantity y conserva el resto de los campos (incluido el id)', () => {
      const order = build({ quantity: 10 });
      const filled = order.fill(4);
      expect(filled.id).toBe(order.id);
      expect(filled.remainingQuantity).toBe(6);
      expect(filled.quantity).toBe(10);
      expect(filled.price).toBe(order.price);
    });

    it('status pasa a PARTIALLY_FILLED con un fill parcial', () => {
      const order = build({ quantity: 10 }).fill(3);
      expect(order.status).toBe(OrderStatus.PARTIALLY_FILLED);
    });

    it('status pasa a COMPLETED cuando remainingQuantity llega a 0', () => {
      const order = build({ quantity: 10 }).fill(10);
      expect(order.status).toBe(OrderStatus.COMPLETED);
      expect(order.remainingQuantity).toBe(0);
    });

    it('status pasa a COMPLETED acumulando varios fills parciales', () => {
      const order = build({ quantity: 10 }).fill(4).fill(6);
      expect(order.status).toBe(OrderStatus.COMPLETED);
    });

    it('rechaza fillear mas de lo pendiente (OrderOverfillError)', () => {
      const order = build({ quantity: 10 });
      expect(() => order.fill(11)).toThrow(OrderOverfillError);
    });

    it('rechaza fillear mas de lo pendiente cuando ya tenia un fill previo', () => {
      const order = build({ quantity: 10 }).fill(8);
      expect(() => order.fill(3)).toThrow(OrderOverfillError);
    });

    it('rechaza fillear una cantidad <= 0', () => {
      const order = build({ quantity: 10 });
      expect(() => order.fill(0)).toThrow(OrderOverfillError);
      expect(() => order.fill(-1)).toThrow(OrderOverfillError);
    });
  });

  describe('isCompatibleWith', () => {
    it('true si lado opuesto, mismo jugador y mismo precio exacto', () => {
      const buy = build({ side: OrderSide.BUY, playerId: 'p1', price: 12.5 });
      const sell = build({ id: 'order-2', side: OrderSide.SELL, playerId: 'p1', price: 12.5 });
      expect(buy.isCompatibleWith(sell)).toBe(true);
      expect(sell.isCompatibleWith(buy)).toBe(true);
    });

    it('false si mismo lado', () => {
      const buy1 = build({ side: OrderSide.BUY, playerId: 'p1', price: 12.5 });
      const buy2 = build({ id: 'order-2', side: OrderSide.BUY, playerId: 'p1', price: 12.5 });
      expect(buy1.isCompatibleWith(buy2)).toBe(false);
    });

    it('false si distinto jugador', () => {
      const buy = build({ side: OrderSide.BUY, playerId: 'p1', price: 12.5 });
      const sell = build({ id: 'order-2', side: OrderSide.SELL, playerId: 'p2', price: 12.5 });
      expect(buy.isCompatibleWith(sell)).toBe(false);
    });

    it('false si el precio difiere, aunque sea por un centavo', () => {
      const buy = build({ side: OrderSide.BUY, playerId: 'p1', price: 12.5 });
      const sell = build({ id: 'order-2', side: OrderSide.SELL, playerId: 'p1', price: 12.51 });
      expect(buy.isCompatibleWith(sell)).toBe(false);
    });

    it('false si la contraparte ya no tiene cantidad pendiente', () => {
      const buy = build({ side: OrderSide.BUY, playerId: 'p1', price: 12.5 });
      const sell = build({
        id: 'order-2',
        side: OrderSide.SELL,
        playerId: 'p1',
        price: 12.5,
        quantity: 5,
      }).fill(5);
      expect(buy.isCompatibleWith(sell)).toBe(false);
    });
  });

  describe('restore', () => {
    it('reconstruye una orden persistida con su remainingQuantity actual', () => {
      const order = Order.restore({
        id: 'order-1',
        userId: 'user-1',
        playerId: 'player-1',
        side: OrderSide.SELL,
        quantity: 10,
        remainingQuantity: 4,
        price: 12.5,
        createdAt,
      });
      expect(order.status).toBe(OrderStatus.PARTIALLY_FILLED);
    });

    it('rechaza remainingQuantity fuera de rango', () => {
      expect(() =>
        Order.restore({
          id: 'order-1',
          userId: 'user-1',
          playerId: 'player-1',
          side: OrderSide.SELL,
          quantity: 10,
          remainingQuantity: 11,
          price: 12.5,
          createdAt,
        }),
      ).toThrow(OrderOverfillError);
    });
  });
});

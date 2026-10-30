import { Order } from './order';
import { OrderSide } from './order-side';
import { OrderStatus } from './order-status';
import { InconsistentOrderStatusError } from './errors/inconsistent-order-status.error';
import { OrderOverfillError } from './errors/order-overfill.error';
import { InvalidOrderQuantityError } from './errors/invalid-order-quantity.error';
import { OrderNotCancellableError } from './errors/order-not-cancellable.error';

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
      expect(order.isCancellable).toBe(true);
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
      expect(order.isCancellable).toBe(true);
    });

    it('status pasa a COMPLETED cuando remainingQuantity llega a 0', () => {
      const order = build({ quantity: 10 }).fill(10);
      expect(order.status).toBe(OrderStatus.COMPLETED);
      expect(order.remainingQuantity).toBe(0);
      expect(order.isCancellable).toBe(false);
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

    it('rechaza fillear una orden cancelada (OrderNotCancellableError)', () => {
      const order = build({ quantity: 10 }).cancel();
      expect(() => order.fill(2)).toThrow(OrderNotCancellableError);
    });
  });

  describe('cancel', () => {
    it('cancela una orden en estado PENDING y pasa a CANCELLED conservando remainingQuantity', () => {
      const order = build({ quantity: 10 });
      const cancelled = order.cancel();
      expect(cancelled.id).toBe(order.id);
      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(cancelled.remainingQuantity).toBe(10);
      expect(cancelled.isCancellable).toBe(false);
    });

    it('cancela una orden en estado PARTIALLY_FILLED y pasa a CANCELLED conservando remainingQuantity', () => {
      const order = build({ quantity: 10 }).fill(4);
      expect(order.status).toBe(OrderStatus.PARTIALLY_FILLED);
      const cancelled = order.cancel();
      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(cancelled.remainingQuantity).toBe(6);
      expect(cancelled.isCancellable).toBe(false);
    });

    it('falla con OrderNotCancellableError si ya está COMPLETED', () => {
      const order = build({ quantity: 10 }).fill(10);
      expect(order.status).toBe(OrderStatus.COMPLETED);
      expect(() => order.cancel()).toThrow(OrderNotCancellableError);
    });

    it('falla con OrderNotCancellableError si ya está CANCELLED', () => {
      const order = build({ quantity: 10 }).cancel();
      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(() => order.cancel()).toThrow(OrderNotCancellableError);
    });
  });

  describe('isCompatibleWith', () => {
    it('true si precio_BUY === precio_SELL', () => {
      const buy = build({ side: OrderSide.BUY, playerId: 'p1', price: 12.5 });
      const sell = build({ id: 'order-2', side: OrderSide.SELL, playerId: 'p1', price: 12.5 });
      expect(buy.isCompatibleWith(sell)).toBe(true);
      expect(sell.isCompatibleWith(buy)).toBe(true);
    });

    it('true si precio_BUY > precio_SELL (comprador paga más de lo que pide el vendedor)', () => {
      const buy = build({ side: OrderSide.BUY, playerId: 'p1', price: 15.0 });
      const sell = build({ id: 'order-2', side: OrderSide.SELL, playerId: 'p1', price: 12.5 });
      expect(buy.isCompatibleWith(sell)).toBe(true);
      expect(sell.isCompatibleWith(buy)).toBe(true);
    });

    it('false si precio_BUY < precio_SELL (el comprador no llega al precio del vendedor)', () => {
      const buy = build({ side: OrderSide.BUY, playerId: 'p1', price: 12.5 });
      const sell = build({ id: 'order-2', side: OrderSide.SELL, playerId: 'p1', price: 12.51 });
      expect(buy.isCompatibleWith(sell)).toBe(false);
      expect(sell.isCompatibleWith(buy)).toBe(false);
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

    it('false si la orden origen está cancelada', () => {
      const buy = build({ side: OrderSide.BUY, playerId: 'p1', price: 15.0 }).cancel();
      const sell = build({ id: 'order-2', side: OrderSide.SELL, playerId: 'p1', price: 12.5 });
      expect(buy.isCompatibleWith(sell)).toBe(false);
    });

    it('false si la orden destino (contraparte) está cancelada', () => {
      const buy = build({ side: OrderSide.BUY, playerId: 'p1', price: 15.0 });
      const sell = build({ id: 'order-2', side: OrderSide.SELL, playerId: 'p1', price: 12.5 }).cancel();
      expect(buy.isCompatibleWith(sell)).toBe(false);
    });
  });

  describe('seed', () => {
    const base = {
      id: 'order-1',
      userId: 'user-1',
      playerId: 'player-1',
      side: OrderSide.BUY,
      quantity: 10,
      price: 12.5,
      createdAt,
    };

    it.each([
      { remainingQuantity: 10, status: OrderStatus.PENDING },
      { remainingQuantity: 4, status: OrderStatus.PARTIALLY_FILLED },
      { remainingQuantity: 0, status: OrderStatus.COMPLETED },
    ])('siembra una orden $status con cantidad pendiente $remainingQuantity', ({ remainingQuantity, status }) => {
      const order = Order.seed({ ...base, remainingQuantity, status });
      expect(order.status).toBe(status);
      expect(order.remainingQuantity).toBe(remainingQuantity);
      expect(order.createdAt).toBe(createdAt);
    });

    it('siembra una orden CANCELLED conservando la cantidad pendiente', () => {
      const order = Order.seed({ ...base, remainingQuantity: 10, status: OrderStatus.CANCELLED });
      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(order.remainingQuantity).toBe(10);
    });

    it('rechaza una cantidad pendiente mayor a la total', () => {
      expect(() => Order.seed({ ...base, remainingQuantity: 11 })).toThrow(OrderOverfillError);
    });

    it('rechaza una cantidad total invalida', () => {
      expect(() => Order.seed({ ...base, quantity: 0, remainingQuantity: 0 })).toThrow(InvalidOrderQuantityError);
    });
  });

  describe('coherencia entre status y remainingQuantity al reconstruir', () => {
    const base = {
      id: 'order-1',
      userId: 'user-1',
      playerId: 'player-1',
      side: OrderSide.BUY,
      quantity: 10,
      price: 12.5,
      createdAt,
    };

    it.each([
      { remainingQuantity: 5, status: OrderStatus.COMPLETED },
      { remainingQuantity: 5, status: OrderStatus.PENDING },
      { remainingQuantity: 10, status: OrderStatus.PARTIALLY_FILLED },
      { remainingQuantity: 0, status: OrderStatus.PENDING },
    ])('rechaza status $status con cantidad pendiente $remainingQuantity', ({ remainingQuantity, status }) => {
      expect(() => Order.restore({ ...base, remainingQuantity, status })).toThrow(InconsistentOrderStatusError);
    });

    it('acepta CANCELLED con cualquier cantidad pendiente', () => {
      for (const remainingQuantity of [0, 4, 10]) {
        const order = Order.restore({ ...base, remainingQuantity, status: OrderStatus.CANCELLED });
        expect(order.status).toBe(OrderStatus.CANCELLED);
      }
    });

    it('sin status informado deriva el estado de la cantidad pendiente', () => {
      expect(Order.restore({ ...base, remainingQuantity: 0 }).status).toBe(OrderStatus.COMPLETED);
      expect(Order.restore({ ...base, remainingQuantity: 3 }).status).toBe(OrderStatus.PARTIALLY_FILLED);
      expect(Order.restore({ ...base, remainingQuantity: 10 }).status).toBe(OrderStatus.PENDING);
    });

    it('una orden cancelada sigue cancelada tras un restore y mantiene su cantidad pendiente', () => {
      const cancelled = build().fill(4).cancel();
      const restored = Order.restore({ ...base, remainingQuantity: cancelled.remainingQuantity, status: cancelled.status });
      expect(restored.status).toBe(OrderStatus.CANCELLED);
      expect(restored.remainingQuantity).toBe(6);
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

    it('reconstruye una orden persistida con status CANCELLED explícito', () => {
      const order = Order.restore({
        id: 'order-1',
        userId: 'user-1',
        playerId: 'player-1',
        side: OrderSide.SELL,
        quantity: 10,
        remainingQuantity: 4,
        price: 12.5,
        createdAt,
        status: OrderStatus.CANCELLED,
      });
      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(order.isCancellable).toBe(false);
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

import { OrdersController } from './orders.controller';
import { OrdersService } from '../../services/orders/orders.service';
import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/order-side';
import { OrderStatus } from '../../domain/orders/order-status';
import { OrderForbiddenError } from '../../domain/orders/errors/order-forbidden.error';
import { OrderNotFoundError } from '../../domain/orders/errors/order-not-found.error';
import { OrderNotCancellableError } from '../../domain/orders/errors/order-not-cancellable.error';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersServiceMock: Partial<OrdersService>;

  const createdAt = new Date('2026-10-21T10:00:00.000Z');

  const createOrder = (
    overrides: Partial<Parameters<typeof Order.create>[0]> & { remainingQuantity?: number } = {},
    status?: OrderStatus,
  ) => {
    const quantity = overrides.quantity ?? 10;
    const remainingQuantity =
      overrides.remainingQuantity !== undefined
        ? overrides.remainingQuantity
        : status === OrderStatus.COMPLETED
          ? 0
          : quantity;

    return Order.restore({
      id: 'e4f8d9b2-3c1a-4d5e-8f9a-0b1c2d3e4f5a',
      userId: 'user-1',
      playerId: 'player-1',
      side: OrderSide.SELL,
      quantity,
      remainingQuantity,
      price: 25.0,
      createdAt,
      status,
      ...overrides,
    });
  };

  beforeEach(() => {
    ordersServiceMock = {
      cancelOrder: jest.fn(),
      getUserOrders: jest.fn(),
      createOrder: jest.fn(),
      getHistory: jest.fn(),
    };
    controller = new OrdersController(ordersServiceMock as OrdersService);
  });

  describe('DELETE /orders/:id (cancel)', () => {
    it('cancela la orden y devuelve OrderResponseDto con status CANCELLED', async () => {
      const cancelledOrder = createOrder({ remainingQuantity: 6 }, OrderStatus.CANCELLED);
      (ordersServiceMock.cancelOrder as jest.Mock).mockResolvedValue(cancelledOrder);

      const result = await controller.cancel('user-1', 'e4f8d9b2-3c1a-4d5e-8f9a-0b1c2d3e4f5a');

      expect(ordersServiceMock.cancelOrder).toHaveBeenCalledWith('e4f8d9b2-3c1a-4d5e-8f9a-0b1c2d3e4f5a', 'user-1');
      expect(result).toMatchObject({
        id: 'e4f8d9b2-3c1a-4d5e-8f9a-0b1c2d3e4f5a',
        side: OrderSide.SELL,
        playerId: 'player-1',
        quantity: 10,
        remainingQuantity: 6,
        price: '25.00',
        status: OrderStatus.CANCELLED,
        fills: [],
      });
    });

    it('propaga OrderForbiddenError si el usuario no es el dueño', async () => {
      (ordersServiceMock.cancelOrder as jest.Mock).mockRejectedValue(new OrderForbiddenError());

      await expect(
        controller.cancel('attacker-user', 'e4f8d9b2-3c1a-4d5e-8f9a-0b1c2d3e4f5a'),
      ).rejects.toThrow(OrderForbiddenError);
    });

    it('propaga OrderNotFoundError si la orden no existe', async () => {
      (ordersServiceMock.cancelOrder as jest.Mock).mockRejectedValue(new OrderNotFoundError());

      await expect(
        controller.cancel('user-1', '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(OrderNotFoundError);
    });

    it('propaga OrderNotCancellableError si la orden ya es terminal', async () => {
      (ordersServiceMock.cancelOrder as jest.Mock).mockRejectedValue(new OrderNotCancellableError());

      await expect(
        controller.cancel('user-1', 'e4f8d9b2-3c1a-4d5e-8f9a-0b1c2d3e4f5a'),
      ).rejects.toThrow(OrderNotCancellableError);
    });
  });

  describe('GET /orders (getOrders)', () => {
    it('devuelve la lista de órdenes del usuario mapeadas a DTO', async () => {
      const orders = [
        createOrder({ id: 'order-1', side: OrderSide.SELL }),
        createOrder({ id: 'order-2', side: OrderSide.BUY }, OrderStatus.COMPLETED),
      ];
      (ordersServiceMock.getUserOrders as jest.Mock).mockResolvedValue(orders);

      const result = await controller.getOrders('user-1');

      expect(ordersServiceMock.getUserOrders).toHaveBeenCalledWith('user-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('order-1');
      expect(result[0].status).toBe(OrderStatus.PENDING);
      expect(result[1].id).toBe('order-2');
      expect(result[1].status).toBe(OrderStatus.COMPLETED);
    });
  });
});


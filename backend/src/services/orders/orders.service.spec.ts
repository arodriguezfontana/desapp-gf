import { OrdersService } from './orders.service';
import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/order-side';
import { OrderStatus } from '../../domain/orders/order-status';
import { OrderNotFoundError } from '../../domain/orders/errors/order-not-found.error';
import { OrderForbiddenError } from '../../domain/orders/errors/order-forbidden.error';
import { OrderNotCancellableError } from '../../domain/orders/errors/order-not-cancellable.error';
import type { OrderRepository } from '../../repositories/orders/order.repository';
import type { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import type { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import type { PlayerRepository } from '../../repositories/player/player.repository';
import type { TransactionManager } from '../../repositories/shared/transaction-manager';
import type { QuotationService } from '../quotation/quotation.service';
import type { Transaction } from '../../repositories/shared/transaction';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepoMock: Partial<OrderRepository>;
  let tokenTxRepoMock: Partial<TokenTransactionRepository>;
  let holdingRepoMock: Partial<TokenHoldingRepository>;
  let playerRepoMock: Partial<PlayerRepository>;
  let txManagerMock: Partial<TransactionManager>;
  let quotationMock: Partial<QuotationService>;

  const fakeTx = { manager: {} } as unknown as Transaction;
  const createdAt = new Date('2026-10-21T10:00:00.000Z');

  const createFakeOrder = (overrides: Partial<Parameters<typeof Order.create>[0]> = {}, status?: OrderStatus) => {
    if (status) {
      return Order.restore({
        id: 'order-1',
        userId: 'user-1',
        playerId: 'player-1',
        side: OrderSide.SELL,
        quantity: 10,
        remainingQuantity: status === OrderStatus.COMPLETED ? 0 : 6,
        price: 25.0,
        createdAt,
        status,
        ...overrides,
      });
    }
    return Order.create({
      id: 'order-1',
      userId: 'user-1',
      playerId: 'player-1',
      side: OrderSide.SELL,
      quantity: 10,
      price: 25.0,
      createdAt,
      ...overrides,
    });
  };

  beforeEach(() => {
    orderRepoMock = {
      findById: jest.fn(),
      findByIdWithLock: jest.fn(),
      findByUserId: jest.fn(),
      findCompatibleCandidates: jest.fn(),
      sumPendingSellQuantity: jest.fn(),
      save: jest.fn(),
      saveInTransaction: jest.fn().mockImplementation((_tx, order) => Promise.resolve(order)),
      lockCompatibleCandidates: jest.fn(),
    };
    tokenTxRepoMock = {
      saveInTransaction: jest.fn(),
      findByUserId: jest.fn(),
    };
    holdingRepoMock = {
      findByUserAndPlayer: jest.fn(),
      lockForUpdate: jest.fn(),
      saveInTransaction: jest.fn(),
    };
    playerRepoMock = {
      findById: jest.fn(),
      findAllActive: jest.fn(),
    };
    txManagerMock = {
      run: jest.fn().mockImplementation((work) => work(fakeTx)),
    };
    quotationMock = {
      valuate: jest.fn(),
    };

    service = new OrdersService(
      orderRepoMock as OrderRepository,
      tokenTxRepoMock as TokenTransactionRepository,
      holdingRepoMock as TokenHoldingRepository,
      playerRepoMock as PlayerRepository,
      txManagerMock as TransactionManager,
      quotationMock as QuotationService,
    );
  });

  describe('cancelOrder', () => {
    it('cancela exitosamente una orden propia en estado PENDING', async () => {
      const order = createFakeOrder({ id: 'order-1', userId: 'user-1' });
      (orderRepoMock.findByIdWithLock as jest.Mock).mockResolvedValue(order);

      const result = await service.cancelOrder('order-1', 'user-1');

      expect(txManagerMock.run).toHaveBeenCalledTimes(1);
      expect(orderRepoMock.findByIdWithLock).toHaveBeenCalledWith(fakeTx, 'order-1');
      expect(orderRepoMock.saveInTransaction).toHaveBeenCalledWith(fakeTx, expect.any(Order));
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.remainingQuantity).toBe(10);
    });

    it('cancela exitosamente una orden propia en estado PARTIALLY_FILLED', async () => {
      const order = createFakeOrder({ id: 'order-1', userId: 'user-1' }).fill(4);
      expect(order.status).toBe(OrderStatus.PARTIALLY_FILLED);
      (orderRepoMock.findByIdWithLock as jest.Mock).mockResolvedValue(order);

      const result = await service.cancelOrder('order-1', 'user-1');

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.remainingQuantity).toBe(6);
      expect(orderRepoMock.saveInTransaction).toHaveBeenCalledWith(fakeTx, expect.objectContaining({
        id: 'order-1',
        status: OrderStatus.CANCELLED,
        remainingQuantity: 6,
      }));
    });

    it('lanza OrderNotFoundError cuando la orden no existe', async () => {
      (orderRepoMock.findByIdWithLock as jest.Mock).mockResolvedValue(null);

      await expect(service.cancelOrder('non-existent-order', 'user-1')).rejects.toThrow(
        OrderNotFoundError,
      );
      expect(orderRepoMock.saveInTransaction).not.toHaveBeenCalled();
    });

    it('lanza OrderForbiddenError cuando la orden pertenece a otro usuario', async () => {
      const order = createFakeOrder({ id: 'order-1', userId: 'other-user' });
      (orderRepoMock.findByIdWithLock as jest.Mock).mockResolvedValue(order);

      await expect(service.cancelOrder('order-1', 'user-1')).rejects.toThrow(
        OrderForbiddenError,
      );
      expect(orderRepoMock.saveInTransaction).not.toHaveBeenCalled();
    });

    it('lanza OrderNotCancellableError cuando la orden ya está COMPLETED', async () => {
      const order = createFakeOrder({ id: 'order-1', userId: 'user-1' }, OrderStatus.COMPLETED);
      (orderRepoMock.findByIdWithLock as jest.Mock).mockResolvedValue(order);

      await expect(service.cancelOrder('order-1', 'user-1')).rejects.toThrow(
        OrderNotCancellableError,
      );
      expect(orderRepoMock.saveInTransaction).not.toHaveBeenCalled();
    });

    it('lanza OrderNotCancellableError cuando la orden ya está CANCELLED', async () => {
      const order = createFakeOrder({ id: 'order-1', userId: 'user-1' }, OrderStatus.CANCELLED);
      (orderRepoMock.findByIdWithLock as jest.Mock).mockResolvedValue(order);

      await expect(service.cancelOrder('order-1', 'user-1')).rejects.toThrow(
        OrderNotCancellableError,
      );
      expect(orderRepoMock.saveInTransaction).not.toHaveBeenCalled();
    });
  });

  describe('getUserOrders', () => {
    it('obtiene las órdenes del usuario delegando en findByUserId', async () => {
      const orders = [
        createFakeOrder({ id: 'order-1', userId: 'user-1' }),
        createFakeOrder({ id: 'order-2', userId: 'user-1' }),
      ];
      (orderRepoMock.findByUserId as jest.Mock).mockResolvedValue(orders);

      const result = await service.getUserOrders('user-1');

      expect(orderRepoMock.findByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(orders);
    });
  });
});


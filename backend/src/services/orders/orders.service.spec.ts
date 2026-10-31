import { OrdersService } from './orders.service';
import { FixedClock, SequentialIdGenerator } from '../../adapters/runtime/fake-runtime';
import { Order } from '../../domain/orders/order';
import { OrderBook } from '../../domain/orders/order-book';
import { OrderSide } from '../../domain/orders/order-side';
import { OrderStatus } from '../../domain/orders/order-status';
import { OrderNotFoundError } from '../../domain/orders/errors/order-not-found.error';
import { OrderForbiddenError } from '../../domain/orders/errors/order-forbidden.error';
import { OrderNotCancellableError } from '../../domain/orders/errors/order-not-cancellable.error';
import { TokenTransactionType } from '../../domain/orders/token-transaction-type';
import { InsufficientHoldingError } from '../../domain/portfolio/errors/insufficient-holding.error';
import { TokenHolding } from '../../domain/portfolio/token-holding';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import type { Player } from '../../domain/player/player';
import { OrderRepository } from '../../repositories/orders/order.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
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
      sumPendingSellQuantity: jest.fn(),
      save: jest.fn(),
      saveInTransaction: jest.fn().mockImplementation((_tx, order) => Promise.resolve(order)),
      lockCompatibleCandidates: jest.fn(),
      getOrderBook: jest.fn(),
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
      new FixedClock(),
      new SequentialIdGenerator('order'),
    );
  });

  describe('createOrder', () => {
    const fixedNow = new Date('2026-10-26T12:00:00.000Z');
    const fakePlayer = { id: 'player-1', name: 'Lionel Messi' } as unknown as Player;

    beforeEach(() => {
      (playerRepoMock.findById as jest.Mock).mockResolvedValue(fakePlayer);
      (quotationMock.valuate as jest.Mock).mockResolvedValue({ value: 25 });
      (orderRepoMock.sumPendingSellQuantity as jest.Mock).mockResolvedValue(0);
      (orderRepoMock.lockCompatibleCandidates as jest.Mock).mockResolvedValue([]);
    });

    it('toma el id y la hora de la orden nueva del IdGenerator y el Clock inyectados', async () => {
      const result = await service.createOrder('buyer', 'player-1', OrderSide.BUY, 4);

      expect(result.order.id).toBe('order-1');
      expect(result.order.createdAt).toEqual(fixedNow);
      expect(result.order.price).toBe(25);
      expect(result.order.status).toBe(OrderStatus.PENDING);
      expect(result.fills).toEqual([]);
    });

    it('genera los asientos de auditoria de cada fill con ids del IdGenerator y la hora del Clock', async () => {
      const candidate = createFakeOrder({
        id: 'candidate-1',
        userId: 'seller',
        side: OrderSide.SELL,
        quantity: 4,
        price: 25,
        createdAt: new Date('2026-10-20T10:00:00.000Z'),
      });
      (orderRepoMock.lockCompatibleCandidates as jest.Mock).mockResolvedValue([candidate]);
      const holdings = {
        buyer: TokenHolding.restore({ id: 'h-buyer', userId: 'buyer', playerId: 'player-1', quantity: 0, updatedAt: createdAt }),
        seller: TokenHolding.restore({ id: 'h-seller', userId: 'seller', playerId: 'player-1', quantity: 10, updatedAt: createdAt }),
      };
      (holdingRepoMock.lockForUpdate as jest.Mock).mockImplementation(async (_tx, userId: 'buyer' | 'seller') => holdings[userId]);

      const result = await service.createOrder('buyer', 'player-1', OrderSide.BUY, 4);

      expect(result.fills).toEqual([{ counterpartOrderId: 'candidate-1', quantity: 4, price: 25 }]);
      const saved = (tokenTxRepoMock.saveInTransaction as jest.Mock).mock.calls.map(([, entry]) => entry);
      expect(saved.map((entry) => entry.id)).toEqual(['order-2', 'order-3']);
      expect(saved.map((entry) => entry.type)).toEqual([TokenTransactionType.CREDIT, TokenTransactionType.DEBIT]);
      expect(saved.map((entry) => entry.userId)).toEqual(['buyer', 'seller']);
      expect(saved.every((entry) => entry.createdAt.getTime() === fixedNow.getTime())).toBe(true);
    });

    it('rechaza una venta sin tokens suficientes (regla de venta del dominio)', async () => {
      (holdingRepoMock.findByUserAndPlayer as jest.Mock).mockResolvedValue(null);

      await expect(service.createOrder('seller', 'player-1', OrderSide.SELL, 1)).rejects.toThrow(InsufficientHoldingError);
      expect(txManagerMock.run).not.toHaveBeenCalled();
    });

    it('lanza PlayerNotFoundError si el jugador no existe', async () => {
      (playerRepoMock.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.createOrder('buyer', 'player-1', OrderSide.BUY, 1)).rejects.toThrow(PlayerNotFoundError);
    });
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
    it('obtiene las órdenes del usuario con el nombre del jugador adjunto', async () => {
      const orders = [
        createFakeOrder({ id: 'order-1', userId: 'user-1', playerId: 'player-1' }),
        createFakeOrder({ id: 'order-2', userId: 'user-1', playerId: 'player-1' }),
      ];
      (orderRepoMock.findByUserId as jest.Mock).mockResolvedValue(orders);
      (playerRepoMock.findAllActive as jest.Mock).mockResolvedValue([
        { id: 'player-1', name: 'Lionel Messi' } as unknown as Player,
      ]);

      const result = await service.getUserOrders('user-1');

      expect(orderRepoMock.findByUserId).toHaveBeenCalledWith('user-1');
      expect(result.every((o) => (o as Order & { playerName: string }).playerName === 'Lionel Messi')).toBe(true);
    });

    it('devuelve array vacío sin consultar jugadores cuando no hay órdenes', async () => {
      (orderRepoMock.findByUserId as jest.Mock).mockResolvedValue([]);

      const result = await service.getUserOrders('user-1');

      expect(result).toHaveLength(0);
      expect(playerRepoMock.findAllActive).not.toHaveBeenCalled();
    });
  });

  describe('getOrderBook', () => {
    it('obtiene el order book delegando en orders.getOrderBook cuando el jugador existe', async () => {
      const fakePlayer = { id: 'player-1', name: 'Lionel Messi' } as unknown as Player;
      const expectedBook = OrderBook.create(
        'player-1',
        [{ price: 25.0, totalQuantity: 10 }],
        [{ price: 26.0, totalQuantity: 15 }],
      );
      (playerRepoMock.findById as jest.Mock).mockResolvedValue(fakePlayer);
      (orderRepoMock.getOrderBook as jest.Mock).mockResolvedValue(expectedBook);

      const result = await service.getOrderBook('player-1');

      expect(playerRepoMock.findById).toHaveBeenCalledWith('player-1');
      expect(orderRepoMock.getOrderBook).toHaveBeenCalledWith('player-1');
      expect(result).toBe(expectedBook);
    });

    it('lanza PlayerNotFoundError si el jugador no existe', async () => {
      (playerRepoMock.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getOrderBook('player-non-existent')).rejects.toThrow(PlayerNotFoundError);
      expect(orderRepoMock.getOrderBook).not.toHaveBeenCalled();
    });
  });
});



import { FixedClock, SequentialIdGenerator } from '../../adapters/runtime/fake-runtime';
import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/enums/order-side';
import { InsufficientHoldingError } from '../../domain/portfolio/errors/insufficient-holding.error';
import { TokenHolding } from '../../domain/portfolio/token-holding';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import type { Player } from '../../domain/player/player';
import { OrderRepository } from '../../repositories/orders/order.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import type { Transaction } from '../../repositories/shared/transaction';
import type { TransactionManager } from '../../repositories/shared/transaction-manager';
import type { BusinessMetrics } from '../../shared/observability/metrics/business-metrics';
import type { QuotationService } from '../quotation/quotation.service';
import { OrdersService } from './orders.service';

/** 031-US1: tokens, volumen y rechazos se miden tras el commit y sin alterar el resultado de la orden. */
describe('OrdersService — métricas de negocio', () => {
  let service: OrdersService;
  let orderRepo: Record<string, jest.Mock>;
  let tokenTxRepo: Record<string, jest.Mock>;
  let holdingRepo: Record<string, jest.Mock>;
  let playerRepo: Record<string, jest.Mock>;
  let txManager: { run: jest.Mock };
  let quotation: { valuate: jest.Mock };
  let metrics: { [K in keyof BusinessMetrics]: jest.Mock };

  const fakeTx = { manager: {} } as unknown as Transaction;
  const createdAt = new Date('2026-10-21T10:00:00.000Z');

  beforeEach(() => {
    orderRepo = {
      sumPendingSellQuantity: jest.fn().mockResolvedValue(0),
      saveInTransaction: jest.fn().mockImplementation((_tx, order) => Promise.resolve(order)),
      lockCompatibleCandidates: jest.fn().mockResolvedValue([]),
    };
    tokenTxRepo = { saveInTransaction: jest.fn() };
    holdingRepo = { findByUserAndPlayer: jest.fn(), lockForUpdate: jest.fn(), saveInTransaction: jest.fn() };
    playerRepo = { findById: jest.fn().mockResolvedValue({ id: 'player-1', name: 'Lionel Messi' } as unknown as Player) };
    txManager = { run: jest.fn().mockImplementation((work) => work(fakeTx)) };
    quotation = { valuate: jest.fn().mockResolvedValue({ value: 25 }) };
    metrics = {
      recordOperation: jest.fn(),
      recordTokensTraded: jest.fn(),
      recordOrderRejection: jest.fn(),
      recordSyncRun: jest.fn(),
      setSyncLastSuccess: jest.fn(),
      recordQuoteRecalculation: jest.fn(),
      recordAlertTriggered: jest.fn(),
      recordNotificationCreated: jest.fn(),
      sseConnectionOpened: jest.fn(),
      sseConnectionClosed: jest.fn(),
    };

    service = new OrdersService(
      orderRepo as unknown as OrderRepository,
      tokenTxRepo as unknown as TokenTransactionRepository,
      holdingRepo as unknown as TokenHoldingRepository,
      playerRepo as unknown as PlayerRepository,
      txManager as unknown as TransactionManager,
      quotation as unknown as QuotationService,
      new FixedClock(),
      new SequentialIdGenerator('order'),
      metrics,
    );
  });

  const withOneFill = () => {
    const candidate = Order.create({
      id: 'candidate-1',
      userId: 'seller',
      playerId: 'player-1',
      side: OrderSide.SELL,
      quantity: 4,
      price: 25,
      createdAt: new Date('2026-10-20T10:00:00.000Z'),
    });
    orderRepo.lockCompatibleCandidates.mockResolvedValue([candidate]);
    const holdings = {
      buyer: TokenHolding.restore({ id: 'h-buyer', userId: 'buyer', playerId: 'player-1', quantity: 0, updatedAt: createdAt }),
      seller: TokenHolding.restore({ id: 'h-seller', userId: 'seller', playerId: 'player-1', quantity: 10, updatedAt: createdAt }),
    };
    holdingRepo.lockForUpdate.mockImplementation(async (_tx, userId: 'buyer' | 'seller') => holdings[userId]);
  };

  it('con fills suma tokens y quantity x price con el lado de la orden que inicia, DESPUÉS del commit', async () => {
    withOneFill();
    const order: string[] = [];
    txManager.run.mockImplementation(async (work) => {
      const result = await work(fakeTx);
      order.push('commit');
      return result;
    });
    metrics.recordTokensTraded.mockImplementation(() => order.push('metric'));

    await service.createOrder('buyer', 'player-1', OrderSide.BUY, 4);

    expect(metrics.recordTokensTraded).toHaveBeenCalledWith('buy', 4, 100);
    expect(order).toEqual(['commit', 'metric']);
    expect(metrics.recordOrderRejection).not.toHaveBeenCalled();
  });

  it('una venta con fills usa el lado sell', async () => {
    const buyOrder = Order.create({
      id: 'candidate-2',
      userId: 'buyer',
      playerId: 'player-1',
      side: OrderSide.BUY,
      quantity: 2,
      price: 25,
      createdAt: new Date('2026-10-20T10:00:00.000Z'),
    });
    orderRepo.lockCompatibleCandidates.mockResolvedValue([buyOrder]);
    holdingRepo.findByUserAndPlayer.mockResolvedValue(
      TokenHolding.restore({ id: 'h-seller', userId: 'seller', playerId: 'player-1', quantity: 10, updatedAt: createdAt }),
    );
    const holdings = {
      buyer: TokenHolding.restore({ id: 'h-buyer', userId: 'buyer', playerId: 'player-1', quantity: 0, updatedAt: createdAt }),
      seller: TokenHolding.restore({ id: 'h-seller', userId: 'seller', playerId: 'player-1', quantity: 10, updatedAt: createdAt }),
    };
    holdingRepo.lockForUpdate.mockImplementation(async (_tx, userId: 'buyer' | 'seller') => holdings[userId]);

    await service.createOrder('seller', 'player-1', OrderSide.SELL, 2);

    expect(metrics.recordTokensTraded).toHaveBeenCalledWith('sell', 2, 50);
  });

  it('sin fills suma 0 tokens y 0 créditos (la orden quedó registrada)', async () => {
    await service.createOrder('buyer', 'player-1', OrderSide.BUY, 4);

    expect(metrics.recordTokensTraded).toHaveBeenCalledWith('buy', 0, 0);
  });

  it('una transacción que se revierte no suma nada ni cuenta rechazo', async () => {
    txManager.run.mockRejectedValue(new Error('rollback'));

    await expect(service.createOrder('buyer', 'player-1', OrderSide.BUY, 4)).rejects.toThrow('rollback');

    expect(metrics.recordTokensTraded).not.toHaveBeenCalled();
    expect(metrics.recordOrderRejection).not.toHaveBeenCalled();
  });

  it('una venta sin tokens cuenta insufficient_tokens y ningún contador de éxito', async () => {
    holdingRepo.findByUserAndPlayer.mockResolvedValue(null);

    await expect(service.createOrder('seller', 'player-1', OrderSide.SELL, 1)).rejects.toThrow(InsufficientHoldingError);

    expect(metrics.recordOrderRejection).toHaveBeenCalledWith('insufficient_tokens');
    expect(metrics.recordTokensTraded).not.toHaveBeenCalled();
  });

  it('otro rechazo de dominio cuenta other', async () => {
    playerRepo.findById.mockResolvedValue(null);

    await expect(service.createOrder('buyer', 'player-1', OrderSide.BUY, 1)).rejects.toThrow(PlayerNotFoundError);

    expect(metrics.recordOrderRejection).toHaveBeenCalledWith('other');
  });

  it('un error inesperado no cuenta como rechazo', async () => {
    quotation.valuate.mockRejectedValue(new Error('boom'));

    await expect(service.createOrder('buyer', 'player-1', OrderSide.BUY, 1)).rejects.toThrow('boom');

    expect(metrics.recordOrderRejection).not.toHaveBeenCalled();
  });

  it('un BusinessMetrics que lanza no altera el resultado ni el error', async () => {
    metrics.recordTokensTraded.mockImplementation(() => {
      throw new Error('métricas rotas');
    });
    metrics.recordOrderRejection.mockImplementation(() => {
      throw new Error('métricas rotas');
    });

    await expect(service.createOrder('buyer', 'player-1', OrderSide.BUY, 4)).resolves.toMatchObject({ fills: [] });

    playerRepo.findById.mockResolvedValue(null);
    await expect(service.createOrder('buyer', 'player-1', OrderSide.BUY, 1)).rejects.toThrow(PlayerNotFoundError);
  });

  it('cancelar una orden no mide tokens ni rechazos de alta', async () => {
    orderRepo.findByIdWithLock = jest.fn().mockResolvedValue(null);

    await expect(service.cancelOrder('x', 'user')).rejects.toBeDefined();

    expect(metrics.recordOrderRejection).not.toHaveBeenCalled();
    expect(metrics.recordTokensTraded).not.toHaveBeenCalled();
  });
});

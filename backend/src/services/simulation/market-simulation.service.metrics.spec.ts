import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FixedClock, SequentialIdGenerator } from '../../adapters/runtime/fake-runtime';
import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { Email } from '../../domain/auth/email';
import { User } from '../../domain/auth/user';
import { UserRole } from '../../domain/auth/user-role';
import { League } from '../../domain/player/enums/league';
import { Position } from '../../domain/player/enums/position';
import { Player } from '../../domain/player/player';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { PriceAlertRepository } from '../../repositories/alerts/price-alert.repository';
import { UserRepository } from '../../repositories/auth/user.repository';
import { OrderRepository } from '../../repositories/orders/order.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import {
  BusinessMetricsDouble,
  createBusinessMetricsDouble,
  makeBusinessMetricsDoubleThrow,
} from '../../shared/observability/metrics/business-metrics.double';
import { QuotationService } from '../quotation/quotation.service';
import { StrategyProvisioningService } from '../quotation/strategy-provisioning.service';
import { MarketSimulationService } from './market-simulation.service';

/**
 * 031-US3: la simulación de mercado cuenta como UN recálculo `manual`. No pasa por
 * `QuotationService.recalculateAll` (que mide sus propias corridas): si pasara, contaría dos veces.
 */
describe('MarketSimulationService — métricas de negocio', () => {
  const adminEmail = 'abi_admin@ejemplo.com';
  const adminUser = User.register('admin-uuid-1', Email.create(adminEmail), 'hash', new Date(), UserRole.ADMIN, 'admin');
  const player = (id: string, position: Position) =>
    Player.restore({
      id,
      name: `Player ${id}`,
      team: 'Chelsea',
      position,
      league: League.PREMIER_LEAGUE,
      passesCompleted: null,
      shots: null,
      interceptions: null,
      rating: null,
    });

  let playerQuotes: { saveMany: jest.Mock; deleteAllByUserId: jest.Mock };
  let quotation: { valuate: jest.Mock; recalculateAll: jest.Mock };
  let metrics: BusinessMetricsDouble;
  let service: MarketSimulationService;

  beforeEach(() => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(adminUser),
      findById: jest.fn(),
      save: jest.fn(),
    } as unknown as UserRepository;
    const hasher = { hash: jest.fn().mockResolvedValue('h'), compare: jest.fn() } as unknown as PasswordHasher;
    const players = {
      findAllActive: jest
        .fn()
        .mockResolvedValue([player('p-1', Position.GK), player('p-2', Position.DF), player('p-3', Position.MF), player('p-4', Position.FW)]),
    } as unknown as PlayerRepository;
    const orders = { save: jest.fn().mockImplementation((o) => Promise.resolve(o)) } as unknown as OrderRepository;
    const holdings = {
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
      findByUserAndPlayer: jest.fn().mockResolvedValue(null),
    } as unknown as TokenHoldingRepository;
    const tokenTransactions = {
      save: jest.fn().mockImplementation((t) => Promise.resolve(t)),
      findByUserId: jest.fn().mockResolvedValue([]),
    } as unknown as TokenTransactionRepository;
    playerQuotes = { saveMany: jest.fn().mockResolvedValue(undefined), deleteAllByUserId: jest.fn().mockResolvedValue(undefined) };
    const strategies = {
      findByUserId: jest.fn().mockResolvedValue([
        ValuationStrategy.create({ id: 's1', userId: 'admin-uuid-1', name: 'General', weights: { rating: 1 }, factorEscala: 1, isSelected: true }),
      ]),
    } as unknown as ValuationStrategyRepository;
    const priceAlerts = {
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      findAllByUserId: jest.fn().mockResolvedValue([]),
    } as unknown as PriceAlertRepository;
    quotation = {
      valuate: jest.fn().mockResolvedValue({ playerId: 'p', strategyId: 's', score: 10, value: 25, appliedPosition: null }),
      recalculateAll: jest.fn(),
    };
    const provisioning = { provisionDefaultStrategiesFor: jest.fn().mockResolvedValue([]) } as unknown as StrategyProvisioningService;
    const config = {
      get: jest.fn().mockImplementation((key: string) => (key === 'ADMIN_EMAIL' ? adminEmail : key === 'ADMIN_PASSWORD' ? 'Abrilrz1!' : null)),
    } as unknown as ConfigService;
    const eventEmitter = { emitAsync: jest.fn().mockResolvedValue([]) } as unknown as EventEmitter2;
    metrics = createBusinessMetricsDouble();

    service = new MarketSimulationService(
      users,
      hasher,
      players,
      orders,
      holdings,
      tokenTransactions,
      playerQuotes as unknown as PlayerQuoteRepository,
      strategies,
      priceAlerts,
      quotation as unknown as QuotationService,
      provisioning,
      config,
      eventEmitter,
      new FixedClock(),
      new SequentialIdGenerator('sim'),
      metrics,
    );
  });

  it('simulate() mide UN recálculo manual/success y NO invoca recalculateAll', async () => {
    const result = await service.simulate();

    expect(result.success).toBe(true);
    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledTimes(1);
    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledWith('manual', 'success', 0);
    // Dueño único de la medición: si esto falla, la simulación pasó por recalculateAll y debe dejar de medir por su cuenta.
    expect(quotation.recalculateAll).not.toHaveBeenCalled();
  });

  it('un fallo al sembrar las cotizaciones cuenta manual/failure una sola vez y relanza el error', async () => {
    const boom = new Error('base caída');
    playerQuotes.saveMany.mockRejectedValue(boom);

    await expect(service.simulate()).rejects.toBe(boom);

    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledTimes(1);
    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledWith('manual', 'failure', 0);
  });

  it('un catálogo vacío no es un recálculo: no cuenta', async () => {
    (service as unknown as { players: { findAllActive: jest.Mock } }).players.findAllActive.mockResolvedValue([]);

    const result = await service.simulate();

    expect(result.success).toBe(false);
    expect(metrics.recordQuoteRecalculation).not.toHaveBeenCalled();
  });

  it('un BusinessMetrics que lanza no altera el resultado de la simulación', async () => {
    makeBusinessMetricsDoubleThrow(metrics);

    await expect(service.simulate()).resolves.toMatchObject({ success: true });
  });
});

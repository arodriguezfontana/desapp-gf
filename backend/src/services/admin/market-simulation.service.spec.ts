import { ConfigService } from '@nestjs/config';
import { MarketSimulationService } from './market-simulation.service';
import { UserRepository } from '../../repositories/auth/user.repository';
import { PasswordHasher } from '../../adapters/auth/password-hasher';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { OrderRepository } from '../../repositories/orders/order.repository';
import { TokenHoldingRepository } from '../../repositories/portfolio/token-holding.repository';
import { TokenTransactionRepository } from '../../repositories/orders/token-transaction.repository';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { QuotationService } from '../quotation/quotation.service';
import { UserStrategyProvisioningService } from '../auth/user-strategy-provisioning.service';
import { User } from '../../domain/auth/user';
import { Email } from '../../domain/auth/email';
import { UserRole } from '../../domain/auth/user-role';
import { Player } from '../../domain/player/player';
import { Position } from '../../domain/player/enums/position';
import { League } from '../../domain/player/enums/league';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { TokenHolding } from '../../domain/portfolio/token-holding';

describe('MarketSimulationService', () => {
  let service: MarketSimulationService;
  let users: jest.Mocked<UserRepository>;
  let hasher: jest.Mocked<PasswordHasher>;
  let players: jest.Mocked<PlayerRepository>;
  let orders: jest.Mocked<OrderRepository>;
  let holdings: jest.Mocked<TokenHoldingRepository>;
  let tokenTransactions: jest.Mocked<TokenTransactionRepository>;
  let playerQuotes: jest.Mocked<PlayerQuoteRepository>;
  let strategies: jest.Mocked<ValuationStrategyRepository>;
  let quotation: jest.Mocked<QuotationService>;
  let strategyProvisioning: jest.Mocked<UserStrategyProvisioningService>;
  let config: jest.Mocked<ConfigService>;

  const adminEmail = 'abi_admin@ejemplo.com';
  const adminUser = User.register(
    'admin-uuid-1',
    Email.create(adminEmail),
    'hash',
    new Date(),
    UserRole.ADMIN,
    'admin',
  );

  const testPlayers: Player[] = [
    Player.restore({
      id: 'p-1',
      name: 'Player One',
      team: 'Chelsea',
      position: Position.GK,
      league: League.PREMIER_LEAGUE,
      passesCompleted: null,
      shots: null,
      interceptions: null,
      rating: null,
    }),
    Player.restore({
      id: 'p-2',
      name: 'Player Two',
      team: 'Chelsea',
      position: Position.DF,
      league: League.PREMIER_LEAGUE,
      passesCompleted: null,
      shots: null,
      interceptions: null,
      rating: null,
    }),
    Player.restore({
      id: 'p-3',
      name: 'Player Three',
      team: 'Chelsea',
      position: Position.MF,
      league: League.PREMIER_LEAGUE,
      passesCompleted: null,
      shots: null,
      interceptions: null,
      rating: null,
    }),
    Player.restore({
      id: 'p-4',
      name: 'Player Four',
      team: 'Chelsea',
      position: Position.FW,
      league: League.PREMIER_LEAGUE,
      passesCompleted: null,
      shots: null,
      interceptions: null,
      rating: null,
    }),
  ];

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    hasher = {
      hash: jest.fn().mockResolvedValue('hashed-pass'),
      compare: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<PasswordHasher>;

    players = {
      findAllActive: jest.fn().mockResolvedValue(testPlayers),
      findById: jest.fn(),
      findPage: jest.fn(),
      findRanking: jest.fn(),
      findActiveExternalIdsByTeam: jest.fn(),
      applyTeamRosterSync: jest.fn(),
    } as unknown as jest.Mocked<PlayerRepository>;

    orders = {
      save: jest.fn().mockImplementation((o) => Promise.resolve(o)),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findCompatibleCandidates: jest.fn(),
      sumPendingSellQuantity: jest.fn(),
      findByIdWithLock: jest.fn(),
      lockCompatibleCandidates: jest.fn(),
      saveInTransaction: jest.fn(),
      getOrderBook: jest.fn(),
    } as unknown as jest.Mocked<OrderRepository>;

    holdings = {
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
      findByUserId: jest.fn(),
      findByUserAndPlayer: jest.fn().mockResolvedValue(null),
      lockForUpdate: jest.fn(),
      saveInTransaction: jest.fn(),
    } as unknown as jest.Mocked<TokenHoldingRepository>;

    tokenTransactions = {
      save: jest.fn().mockImplementation((t) => Promise.resolve(t)),
      saveInTransaction: jest.fn(),
      findByUserId: jest.fn(),
      findCreditsByUserId: jest.fn(),
    } as unknown as jest.Mocked<TokenTransactionRepository>;

    playerQuotes = {
      saveMany: jest.fn().mockResolvedValue(undefined),
      findAllByPlayerIdAndUserId: jest.fn(),
    } as unknown as jest.Mocked<PlayerQuoteRepository>;

    strategies = {
      findByUserId: jest.fn().mockResolvedValue([
        ValuationStrategy.create({
          id: 'strat-1',
          userId: 'admin-uuid-1',
          name: 'General',
          weights: { rating: 1 },
          factorEscala: 1,
          isSelected: true,
        }),
      ]),
      findByIdAndUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      selectStrategy: jest.fn(),
      findAllUserIds: jest.fn(),
    } as unknown as jest.Mocked<ValuationStrategyRepository>;

    quotation = {
      valuate: jest.fn().mockResolvedValue({ playerId: 'p1', strategyId: 's1', score: 10, value: 25.0, appliedPosition: null }),
    } as unknown as jest.Mocked<QuotationService>;

    strategyProvisioning = {
      provisionDefaultStrategiesFor: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<UserStrategyProvisioningService>;

    config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'ADMIN_EMAIL') return adminEmail;
        if (key === 'ADMIN_PASSWORD') return 'Abrilrz1!';
        return null;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new MarketSimulationService(
      users,
      hasher,
      players,
      orders,
      holdings,
      tokenTransactions,
      playerQuotes,
      strategies,
      quotation,
      strategyProvisioning,
      config,
    );
  });

  it('ejecuta exitosamente la simulación con transacciones, holdings, órdenes y cotizaciones', async () => {
    users.findByEmail.mockImplementation(async (email) => {
      if (email.toString() === adminEmail) return adminUser;
      return null;
    });

    const result = await service.simulate();

    expect(result.success).toBe(true);
    expect(result.adminEmail).toBe(adminEmail);
    expect(result.transactionsCreated).toBeGreaterThan(0);
    expect(result.holdingsCreated).toBeGreaterThan(0);
    expect(result.ordersCreated).toBe(4); // 4 admin orders
    expect(result.marketOrdersCreated).toBeGreaterThan(0);
    expect(result.quotesCreated).toBeGreaterThan(0);
    expect(result.playersInvolved).toEqual(['Player One', 'Player Two', 'Player Three', 'Player Four']);

    expect(tokenTransactions.save).toHaveBeenCalled();
    expect(holdings.save).toHaveBeenCalled();
    expect(orders.save).toHaveBeenCalled();
    expect(playerQuotes.saveMany).toHaveBeenCalled();
  });

  it('actualiza un holding existente en lugar de duplicarlo', async () => {
    users.findByEmail.mockResolvedValue(adminUser);
    holdings.findByUserAndPlayer.mockResolvedValue(
      TokenHolding.restore({
        id: 'existing-holding-id',
        userId: adminUser.id,
        playerId: 'p-1',
        quantity: 10,
        updatedAt: new Date(),
      }),
    );

    const result = await service.simulate();

    expect(result.success).toBe(true);
    expect(holdings.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-holding-id',
      }),
    );
  });

  it('retorna error graceful si no hay jugadores activos en el catálogo', async () => {
    users.findByEmail.mockResolvedValue(adminUser);
    players.findAllActive.mockResolvedValue([]);

    const result = await service.simulate();

    expect(result.success).toBe(false);
    expect(result.holdingsCreated).toBe(0);
    expect(result.transactionsCreated).toBe(0);
    expect(result.ordersCreated).toBe(0);
  });

  it('crea el usuario admin y sus estrategias si no existía previamente', async () => {
    users.findByEmail.mockResolvedValue(null);

    const result = await service.simulate();

    expect(result.success).toBe(true);
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.ADMIN,
      }),
    );
    expect(strategyProvisioning.provisionDefaultStrategiesFor).toHaveBeenCalled();
  });
});

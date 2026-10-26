import { QuotationService } from '../quotation.service';
import { FixedClock, SequentialIdGenerator } from '../../../adapters/runtime/fake-runtime';
import { ValuationStrategyRepository } from '../../../repositories/quotation/valuation-strategy.repository';
import { PlayerQuoteRepository } from '../../../repositories/quotation/player-quote.repository';
import { PlayerRepository } from '../../../repositories/player/player.repository';
import { ValuationStrategy } from '../../../domain/quotation/valuation-strategy';
import { ValuationMethod } from '../../../domain/quotation/valuation-method';
import { StrategyNotFoundError } from '../../../domain/quotation/errors/strategy-not-found.error';
import { StrategyOwnershipError } from '../../../domain/quotation/errors/strategy-ownership.error';
import { League } from '../../../domain/player/enums/league';
import { Position } from '../../../domain/player/enums/position';
import { Player } from '../../../domain/player/player';

const USER_ID = 'user-1';

const makeStrategy = (overrides: Partial<Parameters<typeof ValuationStrategy.restore>[0]> = {}) =>
  ValuationStrategy.restore({
    id: 's-1',
    userId: USER_ID,
    name: 'Test',
    weights: { goals: 1 },
    factorEscala: 99,
    isSelected: true,
    ...overrides,
  });

// 10 goles en 10 partidos: por temporada vale 0.25 del techo (40); por partido, 0.95 (1 / (40 / 38)).
const makePlayer = (): Player =>
  Player.restore({
    id: 'p-1',
    name: 'Test Player',
    league: League.LA_LIGA,
    team: 'FC Test',
    position: Position.FW,
    matchesPlayed: 10,
    goals: 10,
    passesCompleted: null,
    shots: null,
    interceptions: null,
    rating: null,
  });

describe('QuotationService — método de valuación (spec 027)', () => {
  let service: QuotationService;
  let strategyRepo: jest.Mocked<ValuationStrategyRepository>;
  let quoteRepo: jest.Mocked<PlayerQuoteRepository>;
  let playerRepo: jest.Mocked<PlayerRepository>;

  beforeEach(() => {
    strategyRepo = {
      findByUserId: jest.fn(),
      findByIdAndUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation(async (s: ValuationStrategy) => s),
      saveMany: jest.fn(),
      selectStrategy: jest.fn(),
      findAllUserIds: jest.fn(),
    };
    quoteRepo = {
      saveMany: jest.fn().mockResolvedValue(undefined),
      findAllByPlayerIdAndUserId: jest.fn(),
      deleteAllByUserId: jest.fn().mockResolvedValue(undefined),
    };
    playerRepo = {
      findPage: jest.fn(),
      findById: jest.fn().mockResolvedValue(makePlayer()),
      findRanking: jest.fn(),
      findActiveExternalIdsByTeam: jest.fn(),
      applyTeamRosterSync: jest.fn(),
      findAllActive: jest.fn().mockResolvedValue([makePlayer()]),
    };
    service = new QuotationService(
      strategyRepo,
      quoteRepo,
      playerRepo,
      { emit: jest.fn(), emitAsync: jest.fn() } as never,
      new FixedClock(),
      new SequentialIdGenerator('quote'),
    );
  });

  describe('editMethod', () => {
    it('cambia el método de una estrategia propia y la persiste', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy());

      const result = await service.editMethod(USER_ID, 's-1', ValuationMethod.PER_MATCH);

      expect(result.method).toBe(ValuationMethod.PER_MATCH);
      expect(strategyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ method: ValuationMethod.PER_MATCH }));
    });

    it('lanza StrategyOwnershipError si la estrategia es de otro usuario', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy({ userId: 'user-2' }));

      await expect(service.editMethod(USER_ID, 's-1', ValuationMethod.PER_MATCH)).rejects.toThrow(
        StrategyOwnershipError,
      );
      expect(strategyRepo.save).not.toHaveBeenCalled();
    });

    it('lanza StrategyNotFoundError si la estrategia no existe', async () => {
      strategyRepo.findById.mockResolvedValue(null);

      await expect(service.editMethod(USER_ID, 's-1', ValuationMethod.PER_MATCH)).rejects.toThrow(
        StrategyNotFoundError,
      );
    });
  });

  describe('valuate', () => {
    it('usa el método de la estrategia seleccionada', async () => {
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ method: ValuationMethod.PER_MATCH })]);

      const result = await service.valuate(USER_ID, 'p-1');

      expect(result.score).toBeCloseTo(0.95, 6);
    });

    it('con el método WEIGHTED normaliza contra el techo de temporada', async () => {
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ method: ValuationMethod.WEIGHTED })]);

      const result = await service.valuate(USER_ID, 'p-1');

      expect(result.score).toBeCloseTo(0.25, 6);
    });
  });

  describe('recalculateAll', () => {
    it('guarda en cada cotización el método con el que se calculó', async () => {
      strategyRepo.findAllUserIds.mockResolvedValue([USER_ID]);
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ method: ValuationMethod.PER_MATCH })]);

      await service.recalculateAll();

      const saved = quoteRepo.saveMany.mock.calls[0][0];
      expect(saved).toHaveLength(1);
      expect(saved[0].valuationMethod).toBe(ValuationMethod.PER_MATCH);
      expect(saved[0].score).toBeCloseTo(0.95, 6);
    });
  });
});

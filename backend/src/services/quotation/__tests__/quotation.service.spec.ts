import { QuotationService } from '../quotation.service';
import { ValuationStrategyRepository } from '../../../repositories/quotation/valuation-strategy.repository';
import { PlayerQuoteRepository } from '../../../repositories/quotation/player-quote.repository';
import { PlayerRepository } from '../../../repositories/player/player.repository';
import { ValuationStrategy } from '../../../domain/quotation/valuation-strategy';
import { NoActiveStrategyError } from '../../../domain/quotation/errors/no-active-strategy.error';
import { RecalculationInProgressError } from '../../../domain/quotation/errors/recalculation-in-progress.error';
import { StrategyNotFoundError } from '../../../domain/quotation/errors/strategy-not-found.error';

const WEIGHTS = { goals: 0.25, assists: 0.15, shots: 0.10, keyPasses: 0.10, dribbles: 0.10, totalTackles: 0.10, rating: 0.20 };

const makeStrategy = (overrides: Partial<Parameters<typeof ValuationStrategy.restore>[0]> = {}) =>
  ValuationStrategy.restore({ id: 's-1', name: 'Test', weights: WEIGHTS, factorEscala: 99, isActive: true, ...overrides });

const makePlayer = () => ({
  id: 'p-1', name: 'Test Player', league: 'La Liga' as any, team: 'FC Test', position: 'FW' as any,
  matchesPlayed: 30, goals: 10, assists: 5, keyPasses: 40, dribbles: 20, totalTackles: 15,
  shots: 30, passesCompleted: 800, interceptions: 10, rating: 7.5, yellowCards: 2, redCards: 0,
});

describe('QuotationService', () => {
  let service: QuotationService;
  let strategyRepo: jest.Mocked<ValuationStrategyRepository>;
  let quoteRepo: jest.Mocked<PlayerQuoteRepository>;
  let playerRepo: jest.Mocked<PlayerRepository>;

  beforeEach(() => {
    strategyRepo = {
      findActive: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      activateStrategy: jest.fn(),
    };
    quoteRepo = {
      saveMany: jest.fn().mockResolvedValue(undefined),
      findLatestByPlayerId: jest.fn(),
    };
    playerRepo = {
      findPage: jest.fn(),
      findById: jest.fn(),
      findActiveExternalIdsByTeam: jest.fn(),
      applyTeamRosterSync: jest.fn(),
      findAllActive: jest.fn(),
    };
    service = new QuotationService(strategyRepo, quoteRepo, playerRepo);
  });

  // ---- getLatestQuoteByPlayerId -----------------------------------------------

  describe('getLatestQuoteByPlayerId()', () => {
    it('delega en quoteRepository.findLatestByPlayerId', async () => {
      quoteRepo.findLatestByPlayerId.mockResolvedValue(null);
      const result = await service.getLatestQuoteByPlayerId('p-1');
      expect(quoteRepo.findLatestByPlayerId).toHaveBeenCalledWith('p-1');
      expect(result).toBeNull();
    });
  });

  // ---- activateStrategy -------------------------------------------------------

  describe('activateStrategy()', () => {
    it('delega en strategyRepository.activateStrategy y retorna la estrategia activada', async () => {
      const strategy = makeStrategy();
      strategyRepo.activateStrategy.mockResolvedValue(strategy);

      const result = await service.activateStrategy('s-1');

      expect(strategyRepo.activateStrategy).toHaveBeenCalledWith('s-1');
      expect(result).toBe(strategy);
    });

    it('propaga StrategyNotFoundError si el repositorio la lanza', async () => {
      strategyRepo.activateStrategy.mockRejectedValue(new StrategyNotFoundError('s-999'));

      await expect(service.activateStrategy('s-999')).rejects.toBeInstanceOf(StrategyNotFoundError);
    });
  });

  // ---- recalculateAll ---------------------------------------------------------

  describe('recalculateAll()', () => {
    it('lanza NoActiveStrategyError si no hay estrategia activa', async () => {
      strategyRepo.findActive.mockResolvedValue(null);

      await expect(service.recalculateAll()).rejects.toBeInstanceOf(NoActiveStrategyError);
    });

    it('lanza RecalculationInProgressError si ya hay un recálculo en curso', async () => {
      strategyRepo.findActive.mockResolvedValue(makeStrategy());
      playerRepo.findAllActive.mockResolvedValue([]);

      // Primer recálculo — no esperamos que termine
      const first = service.recalculateAll();
      // Segundo intento inmediato
      await expect(service.recalculateAll()).rejects.toBeInstanceOf(RecalculationInProgressError);
      await first;
    });

    it('procesa jugadores y devuelve resumen con processedPlayers y errors', async () => {
      const player = makePlayer() as any;
      strategyRepo.findActive.mockResolvedValue(makeStrategy());
      playerRepo.findAllActive.mockResolvedValue([player]);

      const result = await service.recalculateAll();

      expect(result.processedPlayers).toBe(1);
      expect(result.errors).toBe(0);
      expect(typeof result.durationMs).toBe('number');
      expect(quoteRepo.saveMany).toHaveBeenCalledTimes(1);
    });

    it('libera el lock (isRunning = false) aunque falle saveMany', async () => {
      strategyRepo.findActive.mockResolvedValue(makeStrategy());
      playerRepo.findAllActive.mockResolvedValue([makePlayer() as any]);
      quoteRepo.saveMany.mockRejectedValue(new Error('DB error'));

      await expect(service.recalculateAll()).rejects.toThrow('DB error');

      // Después del fallo, el lock debe haberse liberado
      strategyRepo.findActive.mockResolvedValue(null);
      await expect(service.recalculateAll()).rejects.toBeInstanceOf(NoActiveStrategyError);
    });
  });
});

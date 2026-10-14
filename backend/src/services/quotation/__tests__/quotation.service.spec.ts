import { QuotationService } from '../quotation.service';
import { ValuationStrategyRepository } from '../../../repositories/quotation/valuation-strategy.repository';
import { PlayerQuoteRepository } from '../../../repositories/quotation/player-quote.repository';
import { PlayerRepository } from '../../../repositories/player/player.repository';
import { ValuationStrategy } from '../../../domain/quotation/valuation-strategy';
import { NoActiveStrategyError } from '../../../domain/quotation/errors/no-active-strategy.error';
import { RecalculationInProgressError } from '../../../domain/quotation/errors/recalculation-in-progress.error';
import { StrategyNotFoundError } from '../../../domain/quotation/errors/strategy-not-found.error';
import { League } from '../../../domain/player/enums/league';
import { Position } from '../../../domain/player/enums/position';
import { Player } from '../../../domain/player/player';
import { PlayerNotFoundError } from '../../../domain/player/errors/player-not-found.error';
import { PlayerQuote } from '../../../domain/quotation/player-quote';

const WEIGHTS = { goals: 0.25, assists: 0.15, shots: 0.10, keyPasses: 0.10, dribbles: 0.10, totalTackles: 0.10, rating: 0.20 };

const makeStrategy = (overrides: Partial<Parameters<typeof ValuationStrategy.restore>[0]> = {}) =>
  ValuationStrategy.restore({ id: 's-1', name: 'Test', weights: WEIGHTS, factorEscala: 99, isActive: true, ...overrides });

const makePlayer = (): Player =>
  Player.restore({
    id: 'p-1', name: 'Test Player', league: League.LA_LIGA, team: 'FC Test', position: Position.FW,
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
      findAll: jest.fn(),
      save: jest.fn(),
      activateStrategy: jest.fn(),
    };
    quoteRepo = {
      saveMany: jest.fn().mockResolvedValue(undefined),
      findLatestByPlayerId: jest.fn(),
      findLatestAtDate: jest.fn(),
      findAllByPlayerId: jest.fn(),
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

  // ---- listStrategies ----------------------------------------------------------

  describe('listStrategies()', () => {
    it('delega en strategyRepository.findAll y retorna todas las estrategias', async () => {
      const strategies = [makeStrategy({ id: 's-1' }), makeStrategy({ id: 's-2', isActive: false })];
      strategyRepo.findAll.mockResolvedValue(strategies);

      const result = await service.listStrategies();

      expect(strategyRepo.findAll).toHaveBeenCalled();
      expect(result).toBe(strategies);
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
      const player = makePlayer();
      strategyRepo.findActive.mockResolvedValue(makeStrategy());
      playerRepo.findAllActive.mockResolvedValue([player]);

      const result = await service.recalculateAll();

      expect(result.processedPlayers).toBe(1);
      expect(result.errors).toBe(0);
      expect(typeof result.durationMs).toBe('number');
      expect(quoteRepo.saveMany).toHaveBeenCalledTimes(1);
    });

    it('persiste la PlayerQuote con el perfil de posición cuando la estrategia lo define (US1)', async () => {
      const player = makePlayer(); // position: FW
      const fwProfile = { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15 };
      strategyRepo.findActive.mockResolvedValue(
        makeStrategy({ positionWeights: { FW: fwProfile } }),
      );
      playerRepo.findAllActive.mockResolvedValue([player]);

      await service.recalculateAll();

      const [savedQuotes] = quoteRepo.saveMany.mock.calls[0] as [PlayerQuote[]];
      expect(savedQuotes[0].appliedPosition).toBe(Position.FW);
      expect(savedQuotes[0].weightSnapshot).toEqual(fwProfile);
    });

    it('persiste la PlayerQuote con los pesos generales cuando no hay perfil aplicable (US2)', async () => {
      const player = makePlayer(); // position: FW
      strategyRepo.findActive.mockResolvedValue(
        makeStrategy({ positionWeights: { GK: { rating: 1.0 } } }),
      );
      playerRepo.findAllActive.mockResolvedValue([player]);

      await service.recalculateAll();

      const [savedQuotes] = quoteRepo.saveMany.mock.calls[0] as [PlayerQuote[]];
      expect(savedQuotes[0].appliedPosition).toBeNull();
      expect(savedQuotes[0].weightSnapshot).toEqual(WEIGHTS);
    });

    it('libera el lock (isRunning = false) aunque falle saveMany', async () => {
      strategyRepo.findActive.mockResolvedValue(makeStrategy());
      playerRepo.findAllActive.mockResolvedValue([makePlayer()]);
      quoteRepo.saveMany.mockRejectedValue(new Error('DB error'));

      await expect(service.recalculateAll()).rejects.toThrow('DB error');

      // Después del fallo, el lock debe haberse liberado
      strategyRepo.findActive.mockResolvedValue(null);
      await expect(service.recalculateAll()).rejects.toBeInstanceOf(NoActiveStrategyError);
    });
  });

  // ---- getQuoteHistory ---------------------------------------------------------

  describe('getQuoteHistory() (015-player-quote-history)', () => {
    it('lanza PlayerNotFoundError si el jugador no existe', async () => {
      playerRepo.findById.mockResolvedValue(null);

      await expect(service.getQuoteHistory('p-999')).rejects.toBeInstanceOf(PlayerNotFoundError);
      expect(quoteRepo.findAllByPlayerId).not.toHaveBeenCalled();
    });

    it('retorna [] si el jugador existe y no tiene cotizaciones', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      quoteRepo.findAllByPlayerId.mockResolvedValue([]);

      const result = await service.getQuoteHistory('p-1');

      expect(result).toEqual([]);
    });

    it('retorna exactamente lo que resuelve el repositorio, sin reordenar ni transformar', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      const quotes = [
        PlayerQuote.restore({
          id: 'q-1', playerId: 'p-1', strategyId: 's-1', weightSnapshot: WEIGHTS,
          factorEscalaSnapshot: 99, score: 0.1, value: 10.9, calculatedAt: new Date('2026-01-01'),
        }),
        PlayerQuote.restore({
          id: 'q-2', playerId: 'p-1', strategyId: 's-1', weightSnapshot: WEIGHTS,
          factorEscalaSnapshot: 99, score: 0.2, value: 20.8, calculatedAt: new Date('2026-02-01'),
        }),
      ];
      quoteRepo.findAllByPlayerId.mockResolvedValue(quotes);

      const result = await service.getQuoteHistory('p-1');

      expect(result).toBe(quotes);
      expect(quoteRepo.findAllByPlayerId).toHaveBeenCalledWith('p-1');
    });
  });

  // ---- getQuoteAtDate ---------------------------------------------------------

  describe('getQuoteAtDate()', () => {
    const makeQuote = (overrides: Partial<Parameters<typeof PlayerQuote.restore>[0]> = {}) =>
      PlayerQuote.restore({
        id: 'q-1',
        playerId: 'p-1',
        strategyId: 's-1',
        weightSnapshot: WEIGHTS,
        factorEscalaSnapshot: 99,
        score: 0.712345,
        value: 71.52,
        calculatedAt: new Date('2026-09-15T18:30:00.000Z'),
        ...overrides,
      });

    it('lanza PlayerNotFoundError si el jugador no existe', async () => {
      playerRepo.findById.mockResolvedValue(null);

      await expect(service.getQuoteAtDate('p-inexistente')).rejects.toBeInstanceOf(PlayerNotFoundError);
      expect(playerRepo.findById).toHaveBeenCalledWith('p-inexistente');
      expect(quoteRepo.findLatestByPlayerId).not.toHaveBeenCalled();
      expect(quoteRepo.findLatestAtDate).not.toHaveBeenCalled();
    });

    it('retorna null sin lanzar excepción si el jugador existe pero no tiene cotizaciones', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      quoteRepo.findLatestByPlayerId.mockResolvedValue(null);

      const result = await service.getQuoteAtDate('p-1');

      expect(result).toBeNull();
      expect(playerRepo.findById).toHaveBeenCalledWith('p-1');
      expect(quoteRepo.findLatestByPlayerId).toHaveBeenCalledWith('p-1');
    });

    it('retorna cotización y strategyName cuando date no está provisto (cotización más reciente)', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      const quote = makeQuote();
      quoteRepo.findLatestByPlayerId.mockResolvedValue(quote);
      strategyRepo.findById.mockResolvedValue(makeStrategy({ id: 's-1', name: 'Performance General' }));

      const result = await service.getQuoteAtDate('p-1');

      expect(quoteRepo.findLatestByPlayerId).toHaveBeenCalledWith('p-1');
      expect(quoteRepo.findLatestAtDate).not.toHaveBeenCalled();
      expect(strategyRepo.findById).toHaveBeenCalledWith('s-1');
      expect(result).toEqual({
        quote,
        strategyName: 'Performance General',
      });
    });

    it('retorna cotización filtrada por fecha cuando date está provisto', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      const targetDate = new Date('2026-09-15T23:59:59.999Z');
      const quote = makeQuote({ calculatedAt: new Date('2026-09-15T12:00:00.000Z') });
      quoteRepo.findLatestAtDate.mockResolvedValue(quote);
      strategyRepo.findById.mockResolvedValue(makeStrategy({ id: 's-1', name: 'Performance General' }));

      const result = await service.getQuoteAtDate('p-1', targetDate);

      expect(quoteRepo.findLatestAtDate).toHaveBeenCalledWith('p-1', targetDate);
      expect(quoteRepo.findLatestByPlayerId).not.toHaveBeenCalled();
      expect(result).toEqual({
        quote,
        strategyName: 'Performance General',
      });
    });

    it('retorna null sin lanzar excepción si date está provisto y no hay cotización vigente para esa fecha', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      const targetDate = new Date('2026-09-15T23:59:59.999Z');
      quoteRepo.findLatestAtDate.mockResolvedValue(null);

      const result = await service.getQuoteAtDate('p-1', targetDate);

      expect(result).toBeNull();
      expect(quoteRepo.findLatestAtDate).toHaveBeenCalledWith('p-1', targetDate);
    });

    it('usa nombre por defecto si la estrategia asociada no se encuentra en el repositorio', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      const quote = makeQuote();
      quoteRepo.findLatestByPlayerId.mockResolvedValue(quote);
      strategyRepo.findById.mockResolvedValue(null);

      const result = await service.getQuoteAtDate('p-1');

      expect(result).toEqual({
        quote,
        strategyName: 'Estrategia por Defecto',
      });
    });
  });
});

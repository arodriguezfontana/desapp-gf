import { QuotationService } from '../quotation.service';
import { ValuationStrategyRepository } from '../../../repositories/quotation/valuation-strategy.repository';
import { PlayerQuoteRepository } from '../../../repositories/quotation/player-quote.repository';
import { PlayerRepository } from '../../../repositories/player/player.repository';
import { ValuationStrategy } from '../../../domain/quotation/valuation-strategy';
import { RecalculationInProgressError } from '../../../domain/quotation/errors/recalculation-in-progress.error';
import { StrategyNotFoundError } from '../../../domain/quotation/errors/strategy-not-found.error';
import { StrategyOwnershipError } from '../../../domain/quotation/errors/strategy-ownership.error';
import { PlayerQuoteCalculationFailedError } from '../../../domain/quotation/errors/player-quote-calculation-failed.error';
import { League } from '../../../domain/player/enums/league';
import { Position } from '../../../domain/player/enums/position';
import { Player } from '../../../domain/player/player';
import { PlayerNotFoundError } from '../../../domain/player/errors/player-not-found.error';
import { PlayerQuote } from '../../../domain/quotation/player-quote';
import * as calculatePlayerValueModule from '../../../domain/quotation/calculate-player-value';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const WEIGHTS = { goals: 0.25, assists: 0.15, shots: 0.10, keyPasses: 0.10, dribbles: 0.10, totalTackles: 0.10, rating: 0.20 };

const makeStrategy = (overrides: Partial<Parameters<typeof ValuationStrategy.restore>[0]> = {}) =>
  ValuationStrategy.restore({
    id: 's-1',
    userId: USER_ID,
    name: 'Test',
    weights: WEIGHTS,
    factorEscala: 99,
    isSelected: true,
    ...overrides,
  });

const makePlayer = (id = 'p-1'): Player =>
  Player.restore({
    id, name: 'Test Player', league: League.LA_LIGA, team: 'FC Test', position: Position.FW,
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
      findByUserId: jest.fn(),
      findByIdAndUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      selectStrategy: jest.fn(),
    };
    quoteRepo = {
      saveMany: jest.fn().mockResolvedValue(undefined),
      findAllByPlayerIdAndUserId: jest.fn(),
    };
    playerRepo = {
      findPage: jest.fn(),
      findById: jest.fn(),
      findRanking: jest.fn(),
      findActiveExternalIdsByTeam: jest.fn(),
      applyTeamRosterSync: jest.fn(),
      findAllActive: jest.fn(),
    };
    service = new QuotationService(strategyRepo, quoteRepo, playerRepo);
  });

  // ---- listStrategies ----------------------------------------------------------

  describe('listStrategies()', () => {
    it('delega en strategyRepository.findByUserId', async () => {
      const strategies = [makeStrategy({ id: 's-1' }), makeStrategy({ id: 's-2', isSelected: false })];
      strategyRepo.findByUserId.mockResolvedValue(strategies);

      const result = await service.listStrategies(USER_ID);

      expect(strategyRepo.findByUserId).toHaveBeenCalledWith(USER_ID);
      expect(result).toBe(strategies);
    });
  });

  // ---- selectStrategy ------------------------------------------------------------

  describe('selectStrategy()', () => {
    it('selecciona la estrategia propia indicada', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy());
      const selected = makeStrategy({ isSelected: true });
      strategyRepo.selectStrategy.mockResolvedValue(selected);

      const result = await service.selectStrategy(USER_ID, 's-1');

      expect(strategyRepo.selectStrategy).toHaveBeenCalledWith(USER_ID, 's-1');
      expect(result).toBe(selected);
    });

    it('lanza StrategyNotFoundError si la estrategia no existe', async () => {
      strategyRepo.findById.mockResolvedValue(null);

      await expect(service.selectStrategy(USER_ID, 's-999')).rejects.toBeInstanceOf(StrategyNotFoundError);
      expect(strategyRepo.selectStrategy).not.toHaveBeenCalled();
    });

    it('lanza StrategyOwnershipError si la estrategia es de otro usuario', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy({ userId: OTHER_USER_ID }));

      await expect(service.selectStrategy(USER_ID, 's-1')).rejects.toBeInstanceOf(StrategyOwnershipError);
      expect(strategyRepo.selectStrategy).not.toHaveBeenCalled();
    });
  });

  // ---- editWeights / editPositionWeights ------------------------------------------

  describe('editWeights()', () => {
    it('reemplaza los pesos generales y persiste la estrategia actualizada', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy());
      strategyRepo.save.mockImplementation(async (s) => s);

      const newWeights = { goals: 0.5, assists: 0.5 };
      const result = await service.editWeights(USER_ID, 's-1', newWeights);

      expect(result.weights).toEqual(newWeights);
      expect(strategyRepo.save).toHaveBeenCalled();
    });

    it('lanza StrategyOwnershipError si la estrategia es de otro usuario', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy({ userId: OTHER_USER_ID }));

      await expect(
        service.editWeights(USER_ID, 's-1', { goals: 0.5, assists: 0.5 }),
      ).rejects.toBeInstanceOf(StrategyOwnershipError);
      expect(strategyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('editPositionWeights()', () => {
    it('reemplaza el perfil de una posición y persiste la estrategia actualizada', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy());
      strategyRepo.save.mockImplementation(async (s) => s);

      const fwProfile = { goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15 };
      const result = await service.editPositionWeights(USER_ID, 's-1', Position.FW, fwProfile);

      expect(result.positionWeights.FW).toEqual(fwProfile);
    });
  });

  // ---- valuate -------------------------------------------------------------------

  describe('valuate()', () => {
    it('usa la estrategia seleccionada del usuario cuando no se indica strategyId', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      strategyRepo.findByUserId.mockResolvedValue([
        makeStrategy({ id: 's-1', isSelected: true }),
        makeStrategy({ id: 's-2', isSelected: false }),
      ]);

      const result = await service.valuate(USER_ID, 'p-1');

      expect(result.strategyId).toBe('s-1');
    });

    it('usa la estrategia puntual indicada por strategyId si pertenece al usuario', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      strategyRepo.findById.mockResolvedValue(makeStrategy({ id: 's-2', isSelected: false }));

      const result = await service.valuate(USER_ID, 'p-1', 's-2');

      expect(result.strategyId).toBe('s-2');
      expect(strategyRepo.findByUserId).not.toHaveBeenCalled();
    });

    it('lanza StrategyOwnershipError si strategyId indicado no pertenece al usuario', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      strategyRepo.findById.mockResolvedValue(makeStrategy({ id: 's-2', userId: OTHER_USER_ID }));

      await expect(service.valuate(USER_ID, 'p-1', 's-2')).rejects.toBeInstanceOf(StrategyOwnershipError);
    });

    it('lanza PlayerNotFoundError si el jugador no existe, sin resolver ninguna estrategia', async () => {
      playerRepo.findById.mockResolvedValue(null);

      await expect(service.valuate(USER_ID, 'p-999')).rejects.toBeInstanceOf(PlayerNotFoundError);
      expect(strategyRepo.findByUserId).not.toHaveBeenCalled();
    });

    it('no persiste ningún registro', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ isSelected: true })]);

      await service.valuate(USER_ID, 'p-1');

      expect(quoteRepo.saveMany).not.toHaveBeenCalled();
    });
  });

  // ---- recalculate -----------------------------------------------------------------

  describe('recalculate()', () => {
    it('lanza RecalculationInProgressError si el mismo usuario ya tiene uno en curso', async () => {
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ isSelected: true })]);
      playerRepo.findAllActive.mockResolvedValue([]);

      const first = service.recalculate(USER_ID);
      await expect(service.recalculate(USER_ID)).rejects.toBeInstanceOf(RecalculationInProgressError);
      await first;
    });

    it('no bloquea el recálculo de un usuario distinto', async () => {
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ isSelected: true })]);
      playerRepo.findAllActive.mockResolvedValue([]);

      const first = service.recalculate(USER_ID);
      await expect(service.recalculate(OTHER_USER_ID)).resolves.toBeDefined();
      await first;
    });

    it('recalcula todo el catálogo y persiste una cotización por jugador', async () => {
      const player = makePlayer();
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ isSelected: true })]);
      playerRepo.findAllActive.mockResolvedValue([player]);

      const result = await service.recalculate(USER_ID);

      expect(result.recalculated).toHaveLength(1);
      expect(result.skipped).toHaveLength(0);
      expect(quoteRepo.saveMany).toHaveBeenCalledTimes(1);
      const [savedQuotes] = quoteRepo.saveMany.mock.calls[0] as [PlayerQuote[]];
      expect(savedQuotes[0].userId).toBe(USER_ID);
    });

    it('recalcula solo el jugador puntual cuando se indica playerId', async () => {
      const player = makePlayer();
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ isSelected: true })]);
      playerRepo.findById.mockResolvedValue(player);

      const result = await service.recalculate(USER_ID, 'p-1');

      expect(result.recalculated).toHaveLength(1);
      expect(playerRepo.findAllActive).not.toHaveBeenCalled();
    });

    it('lanza PlayerNotFoundError si el playerId puntual no existe', async () => {
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ isSelected: true })]);
      playerRepo.findById.mockResolvedValue(null);

      await expect(service.recalculate(USER_ID, 'p-999')).rejects.toBeInstanceOf(PlayerNotFoundError);
    });

    it('en modo masivo, saltea un jugador que falla y persiste el resto (FR-014b)', async () => {
      const okPlayer = makePlayer('p-1');
      const brokenPlayer = makePlayer('p-2');
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ isSelected: true })]);
      playerRepo.findAllActive.mockResolvedValue([okPlayer, brokenPlayer]);

      const calc = jest.spyOn(calculatePlayerValueModule, 'calculatePlayerValue');
      calc.mockImplementation((player) => {
        if (player.id === 'p-2') {
          throw new Error('fallo simulado de cálculo');
        }
        return { score: 0.5, value: 50.5, appliedPosition: null, weightsUsed: WEIGHTS };
      });

      const result = await service.recalculate(USER_ID);

      expect(result.recalculated).toEqual([{ playerId: 'p-1', value: 50.5, score: 0.5 }]);
      expect(result.skipped).toEqual([{ playerId: 'p-2', reason: 'fallo simulado de cálculo' }]);
      expect(quoteRepo.saveMany).toHaveBeenCalledTimes(1);
      const [savedQuotes] = quoteRepo.saveMany.mock.calls[0] as [PlayerQuote[]];
      expect(savedQuotes).toHaveLength(1);

      calc.mockRestore();
    });

    it('en modo puntual, rechaza toda la operación si falla el cálculo (422, sin persistir)', async () => {
      strategyRepo.findByUserId.mockResolvedValue([makeStrategy({ isSelected: true })]);
      const player = makePlayer();
      playerRepo.findById.mockResolvedValue(player);
      quoteRepo.saveMany.mockImplementation(() => {
        throw new Error('no debería llamarse');
      });
      jest
        .spyOn(calculatePlayerValueModule, 'calculatePlayerValue')
        .mockImplementation(() => {
          throw new Error('fallo simulado de cálculo');
        });

      await expect(service.recalculate(USER_ID, 'p-1')).rejects.toBeInstanceOf(
        PlayerQuoteCalculationFailedError,
      );
      expect(quoteRepo.saveMany).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });

  // ---- getQuoteHistory ---------------------------------------------------------

  describe('getQuoteHistory()', () => {
    it('lanza PlayerNotFoundError si el jugador no existe', async () => {
      playerRepo.findById.mockResolvedValue(null);

      await expect(service.getQuoteHistory(USER_ID, 'p-999')).rejects.toBeInstanceOf(PlayerNotFoundError);
      expect(quoteRepo.findAllByPlayerIdAndUserId).not.toHaveBeenCalled();
    });

    it('retorna [] si el jugador existe y el usuario no tiene cotizaciones propias', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      quoteRepo.findAllByPlayerIdAndUserId.mockResolvedValue([]);

      const result = await service.getQuoteHistory(USER_ID, 'p-1');

      expect(result).toEqual([]);
    });

    it('retorna exactamente lo que resuelve el repositorio, acotado por usuario', async () => {
      playerRepo.findById.mockResolvedValue(makePlayer());
      const quotes = [
        PlayerQuote.restore({
          id: 'q-1', userId: USER_ID, playerId: 'p-1', strategyId: 's-1', weightSnapshot: WEIGHTS,
          factorEscalaSnapshot: 99, score: 0.1, value: 10.9, calculatedAt: new Date('2026-01-01'),
        }),
      ];
      quoteRepo.findAllByPlayerIdAndUserId.mockResolvedValue(quotes);

      const result = await service.getQuoteHistory(USER_ID, 'p-1');

      expect(result).toBe(quotes);
      expect(quoteRepo.findAllByPlayerIdAndUserId).toHaveBeenCalledWith('p-1', USER_ID);
    });
  });
});

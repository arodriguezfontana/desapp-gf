import { StrategyService } from './strategy.service';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { StrategyNotFoundError } from '../../domain/quotation/errors/strategy-not-found.error';
import { StrategyOwnershipError } from '../../domain/quotation/errors/strategy-ownership.error';
import { Position } from '../../domain/player/enums/position';
import { RedisCacheService } from '../../shared/cache/redis-cache.service';

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

describe('StrategyService', () => {
  let service: StrategyService;
  let strategyRepo: jest.Mocked<ValuationStrategyRepository>;

  beforeEach(() => {
    strategyRepo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      saveMany: jest.fn(),
      selectStrategy: jest.fn(),
      findAllUserIds: jest.fn(),
    } as unknown as typeof strategyRepo;
    service = new StrategyService(strategyRepo);
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

  // ---- Invalidación reactiva de ranking en caché --------------------------------
  describe('Invalidación de caché de ranking al mutar estrategias', () => {
    let mockCache: jest.Mocked<Partial<RedisCacheService>>;
    let cachedService: StrategyService;

    beforeEach(() => {
      mockCache = {
        delByPrefix: jest.fn().mockResolvedValue(undefined),
      };
      cachedService = new StrategyService(
        strategyRepo,
        mockCache as unknown as RedisCacheService,
      );
    });

    it('selectStrategy purga el prefijo futval:ranking:<userId>: tras seleccionar estrategia', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy());
      strategyRepo.selectStrategy.mockResolvedValue(makeStrategy({ isSelected: true }));

      await cachedService.selectStrategy(USER_ID, 's-1');

      expect(mockCache.delByPrefix).toHaveBeenCalledWith(`futval:ranking:${USER_ID}:`);
    });

    it('editWeights purga el prefijo futval:ranking:<userId>: tras modificar ponderaciones generales', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy());
      strategyRepo.save.mockImplementation(async (s) => s);

      await cachedService.editWeights(USER_ID, 's-1', { goals: 0.5, assists: 0.5 });

      expect(mockCache.delByPrefix).toHaveBeenCalledWith(`futval:ranking:${USER_ID}:`);
    });

    it('editPositionWeights purga el prefijo futval:ranking:<userId>: tras modificar ponderaciones por posición', async () => {
      strategyRepo.findById.mockResolvedValue(makeStrategy());
      strategyRepo.save.mockImplementation(async (s) => s);

      await cachedService.editPositionWeights(USER_ID, 's-1', Position.FW, { goals: 0.5, shots: 0.5 });

      expect(mockCache.delByPrefix).toHaveBeenCalledWith(`futval:ranking:${USER_ID}:`);
    });

    it('opera en modo fail-open si la invalidación en Redis lanza un error', async () => {
      (mockCache.delByPrefix as jest.Mock).mockRejectedValueOnce(new Error('Redis connection lost'));
      strategyRepo.findById.mockResolvedValue(makeStrategy());
      strategyRepo.selectStrategy.mockResolvedValue(makeStrategy({ isSelected: true }));

      // No debe lanzar excepción, debe retornar la estrategia seleccionada
      const result = await cachedService.selectStrategy(USER_ID, 's-1');

      expect(result).toBeDefined();
    });
  });
});

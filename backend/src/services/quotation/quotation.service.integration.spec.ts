import { ConfigModule } from '@nestjs/config';
import { RuntimeModule } from '../../modules/runtime/runtime.module';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';

import { ValuationStrategyEntity } from '../../repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../repositories/quotation/entities/player-quote.entity';
import { PlayerEntity } from '../../repositories/player/entities/player.entity';
import { UserEntity } from '../../repositories/auth/entities/user.entity';

import { ValuationStrategyMapper } from '../../repositories/quotation/valuation-strategy.mapper';
import { PlayerQuoteMapper } from '../../repositories/quotation/player-quote.mapper';
import { PlayerMapper } from '../../repositories/player/mappers/player.mapper';

import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';

import { StrategyNotFoundError } from '../../domain/quotation/errors/strategy-not-found.error';
import { StrategyOwnershipError } from '../../domain/quotation/errors/strategy-ownership.error';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';

import { QuotationService } from './quotation.service';
import { StrategyService } from './strategy.service';

const WEIGHTS_GOALS_ONLY = { goals: 1 };

describe('QuotationService (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: QuotationService;
  let strategyService: StrategyService;
  let dataSource: DataSource;
  let userIdA: string;
  let userIdB: string;
  let eventEmitter: EventEmitter2;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        RuntimeModule,
        EventEmitterModule.forRoot(),
        DatabaseModule,
        TypeOrmModule.forFeature([ValuationStrategyEntity, PlayerQuoteEntity, PlayerEntity, UserEntity]),
      ],
      providers: [
        QuotationService,
        StrategyService,
        ValuationStrategyMapper,
        PlayerQuoteMapper,
        PlayerMapper,
        ValuationStrategyRepository,
        PlayerQuoteRepository,
        PlayerRepository,
      ],
    }).compile();

    service = moduleRef.get(QuotationService);
    strategyService = moduleRef.get(StrategyService);
    dataSource = moduleRef.get(DataSource);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  const insertUser = async (): Promise<string> => {
    const id = randomUUID();
    await dataSource.getRepository(UserEntity).insert({
      id,
      email: `${id}@test.local`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
      username: 'test-user',
    });
    return id;
  };

  beforeEach(async () => {
    await dataSource.getRepository(PlayerQuoteEntity).clear();
    await dataSource.getRepository(ValuationStrategyEntity).clear();
    await dataSource.getRepository(PlayerEntity).clear();
    await dataSource.getRepository(UserEntity).clear();
    userIdA = await insertUser();
    userIdB = await insertUser();
  });

  afterEach(async () => {
    await dataSource.getRepository(PlayerQuoteEntity).clear();
    await dataSource.getRepository(ValuationStrategyEntity).clear();
    await dataSource.getRepository(PlayerEntity).clear();
    await dataSource.getRepository(UserEntity).clear();
  });

  const insertStrategy = async (opts: {
    userId: string;
    name: string;
    weights: Record<string, number>;
    factorEscala: number;
    isSelected: boolean;
    positionWeights?: Record<string, Record<string, number>>;
  }): Promise<string> => {
    const id = randomUUID();
    await dataSource.getRepository(ValuationStrategyEntity).insert({
      id,
      userId: opts.userId,
      name: opts.name,
      weights: opts.weights,
      factorEscala: String(opts.factorEscala),
      isSelected: opts.isSelected,
      positionWeights: opts.positionWeights ?? null,
    });
    return id;
  };

  const insertPlayer = async (overrides: Partial<PlayerEntity> = {}): Promise<string> => {
    const id = randomUUID();
    await dataSource.getRepository(PlayerEntity).insert({
      id,
      name: 'Jugador Test',
      league: 'Premier League',
      team: 'Test FC',
      position: 'FW',
      goals: 10,
      ...overrides,
    });
    return id;
  };

  describe('listStrategies()', () => {
    it('devuelve array vacío cuando el usuario no tiene estrategias persistidas', async () => {
      const strategies = await strategyService.listStrategies(userIdA);
      expect(strategies).toEqual([]);
    });

    it('devuelve solo las estrategias del usuario indicado, con su isSelected real', async () => {
      await insertStrategy({ userId: userIdA, name: 'Test A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      await insertStrategy({ userId: userIdA, name: 'Test B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 20, isSelected: false });
      await insertStrategy({ userId: userIdB, name: 'De otro usuario', weights: WEIGHTS_GOALS_ONLY, factorEscala: 30, isSelected: true });

      const strategies = await strategyService.listStrategies(userIdA);

      expect(strategies).toHaveLength(2);
      expect(strategies.find((s) => s.name === 'Test A')!.isSelected).toBe(true);
      expect(strategies.find((s) => s.name === 'Test B')!.isSelected).toBe(false);
    });
  });

  describe('selectStrategy()', () => {
    it('desmarca la seleccionada previa y marca la indicada, persistido en la base real', async () => {
      const idA = await insertStrategy({ userId: userIdA, name: 'Test A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      const idB = await insertStrategy({ userId: userIdA, name: 'Test B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 20, isSelected: false });

      const selected = await strategyService.selectStrategy(userIdA, idB);

      expect(selected.isSelected).toBe(true);
      const strategies = await strategyService.listStrategies(userIdA);
      expect(strategies.find((s) => s.id === idA)!.isSelected).toBe(false);
      expect(strategies.find((s) => s.id === idB)!.isSelected).toBe(true);
    });

    it('lanza StrategyNotFoundError para un id inexistente', async () => {
      await expect(strategyService.selectStrategy(userIdA, randomUUID())).rejects.toBeInstanceOf(StrategyNotFoundError);
    });

    it('lanza StrategyOwnershipError al intentar seleccionar una estrategia de otro usuario', async () => {
      const idOfB = await insertStrategy({ userId: userIdB, name: 'De B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });

      await expect(strategyService.selectStrategy(userIdA, idOfB)).rejects.toBeInstanceOf(StrategyOwnershipError);
    });
  });

  describe('recalculateAll()', () => {
    it('calcula y persiste una PlayerQuote por cada combinación usuario × jugador activo', async () => {
      const strategyId = await insertStrategy({
        userId: userIdA,
        name: 'Test seleccionada',
        weights: WEIGHTS_GOALS_ONLY,
        factorEscala: 10,
        isSelected: true,
      });
      await insertPlayer({ goals: 20 });
      await insertPlayer({ goals: 40 });

      const result = await service.recalculateAll();

      expect(result.recalculated).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);

      const quotes = await dataSource.getRepository(PlayerQuoteEntity).find();
      expect(quotes).toHaveLength(2);
      expect(quotes.every((q) => q.strategyId === strategyId && q.userId === userIdA)).toBe(true);
    });

    it('no incluye jugadores dados de baja (removedAt != null)', async () => {
      await insertStrategy({ userId: userIdA, name: 'Test seleccionada', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      await insertPlayer({ removedAt: new Date() });

      const result = await service.recalculateAll();

      expect(result.recalculated).toHaveLength(0);
      const quotes = await dataSource.getRepository(PlayerQuoteEntity).find();
      expect(quotes).toHaveLength(0);
    });

    it('persiste applied_position y weight_snapshot del perfil cuando la estrategia define perfil para la posición del jugador (014-position-weight-profiles)', async () => {
      const fwProfile = { goals: 0.5, shots: 0.5 };
      await insertStrategy({
        userId: userIdA,
        name: 'Con perfil FW',
        weights: WEIGHTS_GOALS_ONLY,
        factorEscala: 10,
        isSelected: true,
        positionWeights: { FW: fwProfile },
      });
      await insertPlayer({ position: 'FW', goals: 20 });

      await service.recalculateAll();

      const [quote] = await dataSource.getRepository(PlayerQuoteEntity).find();
      expect(quote.appliedPosition).toBe('FW');
      expect(quote.weightSnapshot).toEqual(fwProfile);
    });

    it('procesa todos los usuarios en una sola llamada, generando cotizaciones independientes por usuario', async () => {
      await insertStrategy({ userId: userIdA, name: 'A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      await insertStrategy({ userId: userIdB, name: 'B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 20, isSelected: true });
      await insertPlayer({ goals: 20 });

      await service.recalculateAll();

      const quotesA = await dataSource.getRepository(PlayerQuoteEntity).find({ where: { userId: userIdA } });
      const quotesB = await dataSource.getRepository(PlayerQuoteEntity).find({ where: { userId: userIdB } });
      expect(quotesA).toHaveLength(1);
      expect(quotesB).toHaveLength(1);
      expect(quotesA[0].id).not.toBe(quotesB[0].id);
    });

    it('emite quote.recalculated una vez por cada PlayerQuote nueva persistida (025-player-price-alerts)', async () => {
      await insertStrategy({ userId: userIdA, name: 'A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      await insertPlayer({ goals: 20 });

      const received: Array<{ userId: string; playerId: string; value: number }> = [];
      const listener = (payload: { userId: string; playerId: string; value: number }) => received.push(payload);
      eventEmitter.on('quote.recalculated', listener);

      await service.recalculateAll();

      eventEmitter.off('quote.recalculated', listener);
      expect(received).toHaveLength(1);
      expect(received[0].userId).toBe(userIdA);
    });
  });

  describe('getQuoteHistory()', () => {
    it('lanza PlayerNotFoundError si el jugador no existe', async () => {
      await expect(service.getQuoteHistory(userIdA, randomUUID())).rejects.toBeInstanceOf(PlayerNotFoundError);
    });

    it('retorna [] si el jugador existe pero el usuario no tiene cotizaciones propias', async () => {
      const playerId = await insertPlayer();

      const result = await service.getQuoteHistory(userIdA, playerId);

      expect(result).toEqual([]);
    });

    it('retorna únicamente las cotizaciones propias del usuario, nunca las de otro', async () => {
      await insertStrategy({ userId: userIdA, name: 'A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      await insertStrategy({ userId: userIdB, name: 'B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 20, isSelected: true });
      const playerId = await insertPlayer({ goals: 20 });

      await service.recalculateAll();

      const historyA = await service.getQuoteHistory(userIdA, playerId);
      const historyB = await service.getQuoteHistory(userIdB, playerId);

      expect(historyA).toHaveLength(1);
      expect(historyB).toHaveLength(1);
      expect(historyA[0].userId).toBe(userIdA);
      expect(historyB[0].userId).toBe(userIdB);
    });
  });
});

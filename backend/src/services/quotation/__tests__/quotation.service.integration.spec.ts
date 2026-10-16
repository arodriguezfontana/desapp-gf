import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../../database/database.module';
import { VALUATION_STRATEGY_REPOSITORY, PLAYER_QUOTE_REPOSITORY } from '../../../modules/quotation/quotation.constants';
import { PLAYER_REPOSITORY } from '../../../modules/player/player.constants';

import { ValuationStrategyEntity } from '../../../repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../../repositories/quotation/entities/player-quote.entity';
import { PlayerEntity } from '../../../repositories/player/entities/player.entity';
import { UserEntity } from '../../../repositories/auth/entities/user.entity';

import { ValuationStrategyMapper } from '../../../repositories/quotation/valuation-strategy.mapper';
import { PlayerQuoteMapper } from '../../../repositories/quotation/player-quote.mapper';
import { PlayerMapper } from '../../../repositories/player/mappers/player.mapper';

import { TypeOrmValuationStrategyRepository } from '../../../repositories/quotation/typeorm-valuation-strategy.repository';
import { TypeOrmPlayerQuoteRepository } from '../../../repositories/quotation/typeorm-player-quote.repository';
import { TypeOrmPlayerRepository } from '../../../repositories/player/typeorm-player.repository';

import { StrategyNotFoundError } from '../../../domain/quotation/errors/strategy-not-found.error';
import { StrategyOwnershipError } from '../../../domain/quotation/errors/strategy-ownership.error';
import { PlayerNotFoundError } from '../../../domain/player/errors/player-not-found.error';

import { QuotationService } from '../quotation.service';

const WEIGHTS_GOALS_ONLY = { goals: 1 };

describe('QuotationService (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: QuotationService;
  let dataSource: DataSource;
  let userIdA: string;
  let userIdB: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([ValuationStrategyEntity, PlayerQuoteEntity, PlayerEntity, UserEntity]),
      ],
      providers: [
        QuotationService,
        ValuationStrategyMapper,
        PlayerQuoteMapper,
        PlayerMapper,
        { provide: VALUATION_STRATEGY_REPOSITORY, useClass: TypeOrmValuationStrategyRepository },
        { provide: PLAYER_QUOTE_REPOSITORY, useClass: TypeOrmPlayerQuoteRepository },
        { provide: PLAYER_REPOSITORY, useClass: TypeOrmPlayerRepository },
      ],
    }).compile();

    service = moduleRef.get(QuotationService);
    dataSource = moduleRef.get(DataSource);
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
      const strategies = await service.listStrategies(userIdA);
      expect(strategies).toEqual([]);
    });

    it('devuelve solo las estrategias del usuario indicado, con su isSelected real', async () => {
      await insertStrategy({ userId: userIdA, name: 'Test A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      await insertStrategy({ userId: userIdA, name: 'Test B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 20, isSelected: false });
      await insertStrategy({ userId: userIdB, name: 'De otro usuario', weights: WEIGHTS_GOALS_ONLY, factorEscala: 30, isSelected: true });

      const strategies = await service.listStrategies(userIdA);

      expect(strategies).toHaveLength(2);
      expect(strategies.find((s) => s.name === 'Test A')!.isSelected).toBe(true);
      expect(strategies.find((s) => s.name === 'Test B')!.isSelected).toBe(false);
    });
  });

  describe('selectStrategy()', () => {
    it('desmarca la seleccionada previa y marca la indicada, persistido en la base real', async () => {
      const idA = await insertStrategy({ userId: userIdA, name: 'Test A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      const idB = await insertStrategy({ userId: userIdA, name: 'Test B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 20, isSelected: false });

      const selected = await service.selectStrategy(userIdA, idB);

      expect(selected.isSelected).toBe(true);
      const strategies = await service.listStrategies(userIdA);
      expect(strategies.find((s) => s.id === idA)!.isSelected).toBe(false);
      expect(strategies.find((s) => s.id === idB)!.isSelected).toBe(true);
    });

    it('lanza StrategyNotFoundError para un id inexistente', async () => {
      await expect(service.selectStrategy(userIdA, randomUUID())).rejects.toBeInstanceOf(StrategyNotFoundError);
    });

    it('lanza StrategyOwnershipError al intentar seleccionar una estrategia de otro usuario', async () => {
      const idOfB = await insertStrategy({ userId: userIdB, name: 'De B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });

      await expect(service.selectStrategy(userIdA, idOfB)).rejects.toBeInstanceOf(StrategyOwnershipError);
    });
  });

  describe('recalculate()', () => {
    it('calcula y persiste una PlayerQuote real por cada jugador activo, usando la estrategia seleccionada del usuario', async () => {
      const strategyId = await insertStrategy({
        userId: userIdA,
        name: 'Test seleccionada',
        weights: WEIGHTS_GOALS_ONLY,
        factorEscala: 10,
        isSelected: true,
      });
      await insertPlayer({ goals: 20 });
      await insertPlayer({ goals: 40 });

      const result = await service.recalculate(userIdA);

      expect(result.recalculated).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);

      const quotes = await dataSource.getRepository(PlayerQuoteEntity).find();
      expect(quotes).toHaveLength(2);
      expect(quotes.every((q) => q.strategyId === strategyId && q.userId === userIdA)).toBe(true);
    });

    it('no incluye jugadores dados de baja (removedAt != null)', async () => {
      await insertStrategy({ userId: userIdA, name: 'Test seleccionada', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      await insertPlayer({ removedAt: new Date() });

      const result = await service.recalculate(userIdA);

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

      await service.recalculate(userIdA);

      const [quote] = await dataSource.getRepository(PlayerQuoteEntity).find();
      expect(quote.appliedPosition).toBe('FW');
      expect(quote.weightSnapshot).toEqual(fwProfile);
    });

    it('un recálculo de un usuario no incluye ni afecta las cotizaciones de otro usuario', async () => {
      await insertStrategy({ userId: userIdA, name: 'A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isSelected: true });
      await insertStrategy({ userId: userIdB, name: 'B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 20, isSelected: true });
      await insertPlayer({ goals: 20 });

      await service.recalculate(userIdA);
      await service.recalculate(userIdB);

      const quotesA = await dataSource.getRepository(PlayerQuoteEntity).find({ where: { userId: userIdA } });
      const quotesB = await dataSource.getRepository(PlayerQuoteEntity).find({ where: { userId: userIdB } });
      expect(quotesA).toHaveLength(1);
      expect(quotesB).toHaveLength(1);
      expect(quotesA[0].id).not.toBe(quotesB[0].id);
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

      await service.recalculate(userIdA, playerId);
      await service.recalculate(userIdB, playerId);

      const historyA = await service.getQuoteHistory(userIdA, playerId);
      const historyB = await service.getQuoteHistory(userIdB, playerId);

      expect(historyA).toHaveLength(1);
      expect(historyB).toHaveLength(1);
      expect(historyA[0].userId).toBe(userIdA);
      expect(historyB[0].userId).toBe(userIdB);
    });
  });
});

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

import { ValuationStrategyMapper } from '../../../repositories/quotation/valuation-strategy.mapper';
import { PlayerQuoteMapper } from '../../../repositories/quotation/player-quote.mapper';
import { PlayerMapper } from '../../../repositories/player/mappers/player.mapper';

import { TypeOrmValuationStrategyRepository } from '../../../repositories/quotation/typeorm-valuation-strategy.repository';
import { TypeOrmPlayerQuoteRepository } from '../../../repositories/quotation/typeorm-player-quote.repository';
import { TypeOrmPlayerRepository } from '../../../repositories/player/typeorm-player.repository';

import { NoActiveStrategyError } from '../../../domain/quotation/errors/no-active-strategy.error';
import { StrategyNotFoundError } from '../../../domain/quotation/errors/strategy-not-found.error';
import { PlayerNotFoundError } from '../../../domain/player/errors/player-not-found.error';

import { QuotationService } from '../quotation.service';

const WEIGHTS_GOALS_ONLY = { goals: 1 };

describe('QuotationService (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: QuotationService;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([ValuationStrategyEntity, PlayerQuoteEntity, PlayerEntity]),
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

  afterEach(async () => {
    await dataSource.getRepository(PlayerQuoteEntity).clear();
    await dataSource.getRepository(ValuationStrategyEntity).clear();
    await dataSource.getRepository(PlayerEntity).clear();
  });

  const insertStrategy = async (opts: {
    name: string;
    weights: Record<string, number>;
    factorEscala: number;
    isActive: boolean;
    positionWeights?: Record<string, Record<string, number>>;
  }): Promise<string> => {
    const id = randomUUID();
    await dataSource.getRepository(ValuationStrategyEntity).insert({
      id,
      name: opts.name,
      weights: opts.weights,
      factorEscala: String(opts.factorEscala),
      isActive: opts.isActive,
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
    it('devuelve array vacío cuando no hay estrategias persistidas', async () => {
      const strategies = await service.listStrategies();
      expect(strategies).toEqual([]);
    });

    it('devuelve todas las estrategias persistidas con su isActive real', async () => {
      await insertStrategy({ name: 'Test A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isActive: true });
      await insertStrategy({ name: 'Test B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 20, isActive: false });

      const strategies = await service.listStrategies();

      expect(strategies).toHaveLength(2);
      expect(strategies.find((s) => s.name === 'Test A')!.isActive).toBe(true);
      expect(strategies.find((s) => s.name === 'Test B')!.isActive).toBe(false);
    });
  });

  describe('activateStrategy()', () => {
    it('desactiva la estrategia activa y activa la indicada, persistido en la base real', async () => {
      const idA = await insertStrategy({ name: 'Test A', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isActive: true });
      const idB = await insertStrategy({ name: 'Test B', weights: WEIGHTS_GOALS_ONLY, factorEscala: 20, isActive: false });

      const activated = await service.activateStrategy(idB);

      expect(activated.isActive).toBe(true);
      const strategies = await service.listStrategies();
      expect(strategies.find((s) => s.id === idA)!.isActive).toBe(false);
      expect(strategies.find((s) => s.id === idB)!.isActive).toBe(true);
    });

    it('lanza StrategyNotFoundError para un id inexistente', async () => {
      await expect(service.activateStrategy(randomUUID())).rejects.toBeInstanceOf(StrategyNotFoundError);
    });
  });

  describe('recalculateAll()', () => {
    it('lanza NoActiveStrategyError si no hay ninguna estrategia activa', async () => {
      await expect(service.recalculateAll()).rejects.toBeInstanceOf(NoActiveStrategyError);
    });

    it('calcula y persiste una PlayerQuote real por cada jugador activo, usando la estrategia activa', async () => {
      const strategyId = await insertStrategy({
        name: 'Test activa',
        weights: WEIGHTS_GOALS_ONLY,
        factorEscala: 10,
        isActive: true,
      });
      await insertPlayer({ goals: 20 });
      await insertPlayer({ goals: 40 });

      const result = await service.recalculateAll();

      expect(result.processedPlayers).toBe(2);
      expect(result.errors).toBe(0);

      const quotes = await dataSource.getRepository(PlayerQuoteEntity).find();
      expect(quotes).toHaveLength(2);
      expect(quotes.every((q) => q.strategyId === strategyId)).toBe(true);
    });

    it('no incluye jugadores dados de baja (removedAt != null)', async () => {
      await insertStrategy({ name: 'Test activa', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isActive: true });
      await insertPlayer({ removedAt: new Date() });

      const result = await service.recalculateAll();

      expect(result.processedPlayers).toBe(0);
      const quotes = await dataSource.getRepository(PlayerQuoteEntity).find();
      expect(quotes).toHaveLength(0);
    });

    it('persiste applied_position y weight_snapshot del perfil cuando la estrategia define perfil para la posición del jugador (US1, 014-position-weight-profiles)', async () => {
      const fwProfile = { goals: 0.5, shots: 0.5 };
      await insertStrategy({
        name: 'Con perfil FW',
        weights: WEIGHTS_GOALS_ONLY,
        factorEscala: 10,
        isActive: true,
        positionWeights: { FW: fwProfile },
      });
      await insertPlayer({ position: 'FW', goals: 20 });

      await service.recalculateAll();

      const [quote] = await dataSource.getRepository(PlayerQuoteEntity).find();
      expect(quote.appliedPosition).toBe('FW');
      expect(quote.weightSnapshot).toEqual(fwProfile);
    });

    it('persiste applied_position null y weight_snapshot general cuando no hay perfil para la posición del jugador (US2, 014-position-weight-profiles)', async () => {
      await insertStrategy({
        name: 'Con perfil solo GK',
        weights: WEIGHTS_GOALS_ONLY,
        factorEscala: 10,
        isActive: true,
        positionWeights: { GK: { rating: 1.0 } },
      });
      await insertPlayer({ position: 'FW', goals: 20 });

      await service.recalculateAll();

      const [quote] = await dataSource.getRepository(PlayerQuoteEntity).find();
      expect(quote.appliedPosition).toBeNull();
      expect(quote.weightSnapshot).toEqual(WEIGHTS_GOALS_ONLY);
    });
  });

  describe('getQuoteAtDate() / getLatestQuoteByPlayerId()', () => {
    it('lanza PlayerNotFoundError si el jugador no existe', async () => {
      await expect(service.getQuoteAtDate(randomUUID())).rejects.toBeInstanceOf(PlayerNotFoundError);
    });

    it('retorna null si el jugador existe pero no tiene cotizaciones', async () => {
      const playerId = await insertPlayer();

      const result = await service.getQuoteAtDate(playerId);

      expect(result).toBeNull();
    });

    it('retorna la cotización real con el nombre de la estrategia que la calculó', async () => {
      await insertStrategy({ name: 'Test Nombrada', weights: WEIGHTS_GOALS_ONLY, factorEscala: 10, isActive: true });
      const playerId = await insertPlayer({ goals: 20 });
      await service.recalculateAll();

      const result = await service.getQuoteAtDate(playerId);

      expect(result).not.toBeNull();
      expect(result!.strategyName).toBe('Test Nombrada');
      expect(result!.quote.playerId).toBe(playerId);
    });
  });
});

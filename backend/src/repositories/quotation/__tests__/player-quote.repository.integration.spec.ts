import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../../../database/database.module';
import { PlayerQuote } from '../../../domain/quotation/player-quote';
import { PlayerQuoteEntity } from '../entities/player-quote.entity';
import { PlayerQuoteMapper } from '../player-quote.mapper';
import { PlayerQuoteRepository } from '../player-quote.repository';
import { UserEntity } from '../../../repositories/auth/entities/user.entity';

const PLAYER_ID = randomUUID();
const STRATEGY_ID = randomUUID();
const WEIGHTS = { goals: 0.25, assists: 0.15, rating: 0.20 };

describe('PlayerQuoteRepository (integración, 019-per-user-valuation-strategies)', () => {
  let moduleRef: TestingModule;
  let repo: PlayerQuoteRepository;
  let dataSource: DataSource;
  let userIdA: string;
  let userIdB: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PlayerQuoteEntity, UserEntity]),
      ],
      providers: [PlayerQuoteMapper, PlayerQuoteRepository],
    }).compile();

    repo = moduleRef.get(PlayerQuoteRepository);
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
      username: 'test-user',
    });
    return id;
  };

  const makeQuote = (overrides: Partial<Parameters<typeof PlayerQuote.restore>[0]> = {}): PlayerQuote =>
    PlayerQuote.restore({
      id: randomUUID(),
      userId: userIdA,
      playerId: PLAYER_ID,
      strategyId: STRATEGY_ID,
      weightSnapshot: WEIGHTS,
      factorEscalaSnapshot: 99,
      score: 0.712345,
      value: 71.52,
      calculatedAt: new Date('2026-09-15T12:00:00.000Z'),
      ...overrides,
    });

  beforeEach(async () => {
    userIdA = await insertUser();
    userIdB = await insertUser();
  });

  afterEach(async () => {
    await dataSource.getRepository(PlayerQuoteEntity).clear();
    await dataSource.getRepository(UserEntity).clear();
  });

  describe('saveMany', () => {
    it('no falla con array vacío', async () => {
      await expect(repo.saveMany([])).resolves.toBeUndefined();
    });

    it('persiste múltiples cotizaciones correctamente', async () => {
      const quotes = [makeQuote(), makeQuote()];

      await repo.saveMany(quotes);

      const count = await dataSource.getRepository(PlayerQuoteEntity).count();
      expect(count).toBe(2);
    });

    it('persiste los valores numéricos con precision correcta', async () => {
      const quote = makeQuote({ score: 0.712345, value: 71.52 });

      await repo.saveMany([quote]);

      const entity = await dataSource.getRepository(PlayerQuoteEntity).findOneBy({ id: quote.id });
      expect(Number.parseFloat(entity!.score)).toBeCloseTo(0.712345, 5);
      expect(Number.parseFloat(entity!.value)).toBeCloseTo(71.52, 2);
    });

    it('persiste correctamente más filas que el tamaño de lote del insert batcheado, sin exceder el límite de parámetros de Postgres', async () => {
      // PlayerQuoteEntity tiene 10 columnas; un insert sin batchear de 1200
      // filas usaría 12000 parámetros (no supera el límite por sí solo, pero
      // reproduce que el batching no pierde ni duplica filas al cruzar el
      // límite interno de lote del repositorio).
      const quotes = Array.from({ length: 1200 }, (_, i) =>
        makeQuote({ calculatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)) }),
      );

      await repo.saveMany(quotes);

      const count = await dataSource.getRepository(PlayerQuoteEntity).count();
      expect(count).toBe(1200);
    }, 30000);
  });

  describe('findAllByPlayerIdAndUserId (019-per-user-valuation-strategies)', () => {
    it('retorna [] cuando el jugador no tiene cotizaciones del usuario', async () => {
      const result = await repo.findAllByPlayerIdAndUserId(PLAYER_ID, userIdA);
      expect(result).toEqual([]);
    });

    it('retorna todas las cotizaciones propias del jugador ordenadas ascendente por calculatedAt', async () => {
      await repo.saveMany([
        makeQuote({ id: randomUUID(), calculatedAt: new Date('2026-09-20T00:00:00.000Z'), score: 0.7, value: 70 }),
        makeQuote({ id: randomUUID(), calculatedAt: new Date('2026-09-05T00:00:00.000Z'), score: 0.3, value: 30 }),
        makeQuote({ id: randomUUID(), calculatedAt: new Date('2026-09-12T00:00:00.000Z'), score: 0.55, value: 55 }),
      ]);

      const result = await repo.findAllByPlayerIdAndUserId(PLAYER_ID, userIdA);

      expect(result).toHaveLength(3);
      expect(result.map((q) => q.calculatedAt.toISOString())).toEqual([
        new Date('2026-09-05T00:00:00.000Z').toISOString(),
        new Date('2026-09-12T00:00:00.000Z').toISOString(),
        new Date('2026-09-20T00:00:00.000Z').toISOString(),
      ]);
    });

    it('no incluye cotizaciones de otro jugador', async () => {
      const otherPlayerId = randomUUID();
      await repo.saveMany([
        makeQuote({ id: randomUUID(), calculatedAt: new Date('2026-09-10T00:00:00.000Z') }),
        makeQuote({ id: randomUUID(), playerId: otherPlayerId, calculatedAt: new Date('2026-09-11T00:00:00.000Z') }),
      ]);

      const result = await repo.findAllByPlayerIdAndUserId(PLAYER_ID, userIdA);

      expect(result).toHaveLength(1);
      expect(result.every((q) => q.playerId === PLAYER_ID)).toBe(true);
    });

    it('no incluye cotizaciones del mismo jugador generadas por otro usuario (DD-002)', async () => {
      await repo.saveMany([
        makeQuote({ id: randomUUID(), userId: userIdA, calculatedAt: new Date('2026-09-10T00:00:00.000Z') }),
        makeQuote({ id: randomUUID(), userId: userIdB, calculatedAt: new Date('2026-09-11T00:00:00.000Z') }),
      ]);

      const resultA = await repo.findAllByPlayerIdAndUserId(PLAYER_ID, userIdA);
      const resultB = await repo.findAllByPlayerIdAndUserId(PLAYER_ID, userIdB);

      expect(resultA).toHaveLength(1);
      expect(resultB).toHaveLength(1);
      expect(resultA[0].userId).toBe(userIdA);
      expect(resultB[0].userId).toBe(userIdB);
    });
  });
});

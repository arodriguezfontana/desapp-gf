import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../../../database/database.module';
import { PlayerQuote } from '../../../domain/quotation/player-quote';
import { PlayerQuoteEntity } from '../entities/player-quote.entity';
import { PlayerQuoteMapper } from '../player-quote.mapper';
import { TypeOrmPlayerQuoteRepository } from '../typeorm-player-quote.repository';

const PLAYER_ID = randomUUID();
const STRATEGY_ID = randomUUID();
const WEIGHTS = { goals: 0.25, assists: 0.15, rating: 0.20 };

const makeQuote = (overrides: Partial<Parameters<typeof PlayerQuote.restore>[0]> = {}): PlayerQuote =>
  PlayerQuote.restore({
    id: randomUUID(),
    playerId: PLAYER_ID,
    strategyId: STRATEGY_ID,
    weightSnapshot: WEIGHTS,
    factorEscalaSnapshot: 99,
    score: 0.712345,
    value: 71.52,
    calculatedAt: new Date('2026-09-15T12:00:00.000Z'),
    ...overrides,
  });

describe('TypeOrmPlayerQuoteRepository (integración)', () => {
  let moduleRef: TestingModule;
  let repo: TypeOrmPlayerQuoteRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PlayerQuoteEntity]),
      ],
      providers: [PlayerQuoteMapper, TypeOrmPlayerQuoteRepository],
    }).compile();

    repo = moduleRef.get(TypeOrmPlayerQuoteRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await dataSource.getRepository(PlayerQuoteEntity).clear();
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
  });

  describe('findLatestByPlayerId', () => {
    it('retorna null cuando no hay cotizaciones para el jugador', async () => {
      const result = await repo.findLatestByPlayerId(randomUUID());
      expect(result).toBeNull();
    });

    it('retorna la cotización más reciente (ORDER BY calculatedAt DESC)', async () => {
      await repo.saveMany([
        makeQuote({ calculatedAt: new Date('2026-09-10T12:00:00.000Z'), score: 0.3, value: 30.7 }),
        makeQuote({ calculatedAt: new Date('2026-09-20T12:00:00.000Z'), score: 0.7, value: 70.3 }),
        makeQuote({ calculatedAt: new Date('2026-09-15T12:00:00.000Z'), score: 0.5, value: 50.5 }),
      ]);

      const result = await repo.findLatestByPlayerId(PLAYER_ID);

      expect(result).not.toBeNull();
      expect(result!.calculatedAt).toEqual(new Date('2026-09-20T12:00:00.000Z'));
    });

    it('retorna solo la cotización del jugador solicitado', async () => {
      const otherPlayerId = randomUUID();
      await repo.saveMany([
        makeQuote({ playerId: otherPlayerId, score: 0.9, value: 90 }),
        makeQuote({ score: 0.5, value: 50 }),
      ]);

      const result = await repo.findLatestByPlayerId(PLAYER_ID);

      expect(result).not.toBeNull();
      expect(result!.playerId).toBe(PLAYER_ID);
    });
  });

  describe('findLatestAtDate', () => {
    it('retorna null cuando no hay cotizaciones anteriores a la fecha', async () => {
      await repo.saveMany([
        makeQuote({ calculatedAt: new Date('2026-10-01T12:00:00.000Z') }),
      ]);

      const result = await repo.findLatestAtDate(PLAYER_ID, new Date('2026-09-15T23:59:59.999Z'));

      expect(result).toBeNull();
    });

    it('retorna la cotización vigente en la fecha (calculatedAt <= date)', async () => {
      await repo.saveMany([
        makeQuote({ calculatedAt: new Date('2026-09-10T12:00:00.000Z'), score: 0.4, value: 40.6 }),
        makeQuote({ calculatedAt: new Date('2026-09-20T12:00:00.000Z'), score: 0.7, value: 70.3 }),
      ]);

      const result = await repo.findLatestAtDate(PLAYER_ID, new Date('2026-09-15T23:59:59.999Z'));

      expect(result).not.toBeNull();
      expect(result!.calculatedAt).toEqual(new Date('2026-09-10T12:00:00.000Z'));
    });

    it('incluye una cotización cuyo calculatedAt cae exactamente el mismo día', async () => {
      await repo.saveMany([
        makeQuote({ calculatedAt: new Date('2026-09-15T10:00:00.000Z'), score: 0.55, value: 55.45 }),
      ]);

      const result = await repo.findLatestAtDate(PLAYER_ID, new Date('2026-09-15T23:59:59.999Z'));

      expect(result).not.toBeNull();
      expect(result!.calculatedAt).toEqual(new Date('2026-09-15T10:00:00.000Z'));
    });

    it('devuelve la más reciente de varias cotizaciones dentro del rango', async () => {
      await repo.saveMany([
        makeQuote({ calculatedAt: new Date('2026-09-05T08:00:00.000Z'), score: 0.3, value: 30 }),
        makeQuote({ calculatedAt: new Date('2026-09-12T14:00:00.000Z'), score: 0.55, value: 55.45 }),
        makeQuote({ calculatedAt: new Date('2026-09-20T10:00:00.000Z'), score: 0.7, value: 70 }),
      ]);

      const result = await repo.findLatestAtDate(PLAYER_ID, new Date('2026-09-15T23:59:59.999Z'));

      expect(result).not.toBeNull();
      expect(result!.calculatedAt).toEqual(new Date('2026-09-12T14:00:00.000Z'));
    });
  });
});

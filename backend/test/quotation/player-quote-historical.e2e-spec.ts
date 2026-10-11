import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { ValuationStrategyEntity } from '../../src/repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../src/repositories/quotation/entities/player-quote.entity';
import { createTestApp, TestContext } from '../test-app';

describe('GET /players/:id/quote?at=... (e2e, spec 013 - US2 Cotización Histórica)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  let testApiKey: string;
  let testPlayer: PlayerEntity;
  let testStrategy: ValuationStrategyEntity;

  const registerLoginAndIssueApiKey = async (email: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!' });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    const token = login.body.accessToken as string;
    const issued = await request(server()).post('/auth/api-key').set('Authorization', `Bearer ${token}`);
    return issued.body.apiKey as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    testApiKey = await registerLoginAndIssueApiKey('quote-historical-e2e@mail.com');
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.dataSource.getRepository(PlayerQuoteEntity).clear();

    const playerRepo = ctx.dataSource.getRepository(PlayerEntity);
    const players = await playerRepo.find({ take: 1 });
    if (players.length > 0) {
      testPlayer = players[0];
    } else {
      testPlayer = await playerRepo.save({
        id: randomUUID(),
        externalId: 'ext-hist-1',
        name: 'Histórico Player',
        league: 'La Liga',
        team: 'Barcelona',
        position: 'MF',
        matchesPlayed: 10,
        passesCompleted: 100,
        shots: 20,
        interceptions: 5,
        rating: 7.2,
        goals: 5,
        assists: 3,
        keyPasses: 10,
        dribbles: 8,
        totalTackles: 4,
        yellowCards: 1,
        redCards: 0,
      });
    }

    const strategyRepo = ctx.dataSource.getRepository(ValuationStrategyEntity);
    const strategies = await strategyRepo.find({ take: 1 });
    if (strategies.length > 0) {
      testStrategy = strategies[0];
    } else {
      testStrategy = await strategyRepo.save({
        id: randomUUID(),
        name: 'Estrategia Histórica',
        weights: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        factorEscala: '99.0000',
        isActive: true,
      });
    }
  });

  describe('Validación de formato de fecha "at"', () => {
    it('fecha con formato texto inválido → 400 Bad Request', async () => {
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=invalido`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('El parámetro "at" debe ser una fecha válida en formato ISO 8601');
    });

    it('fecha de calendario inválida (ej. 2026-02-31) → 400 Bad Request', async () => {
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-02-31`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('El parámetro "at" debe ser una fecha válida en formato ISO 8601');
    });
  });

  describe('Semántica temporal "vigente ese día" (calculatedAt <= fecha)', () => {
    it('fecha anterior a la primera cotización del jugador → 204 No Content', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);
      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        score: '0.600000',
        value: '60.40',
        calculatedAt: new Date('2026-09-15T12:00:00Z'),
      });

      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-09-14`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('retorna la cotización calculada más reciente menor o igual al final del día solicitado', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      // Cotización 1: 10 de Septiembre
      const quote1 = await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        score: '0.500000',
        value: '50.50',
        calculatedAt: new Date('2026-09-10T10:00:00Z'),
      });

      // Cotización 2: 20 de Septiembre
      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.7, assists: 0.3 },
        factorEscalaSnapshot: '99.0000',
        score: '0.800000',
        value: '80.20',
        calculatedAt: new Date('2026-09-20T10:00:00Z'),
      });

      // Consultar fecha 15 de Septiembre -> debe retornar quote1 (10 de Septiembre)
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-09-15`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe(50.50);
      expect(res.body.score).toBe(0.500000);
      expect(res.body.calculatedAt).toBe(quote1.calculatedAt.toISOString());
    });

    it('cotización calculada el mismo día antes del corte UTC 23:59:59.999Z es retornada', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      const quoteSameDay = await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.4, assists: 0.6 },
        factorEscalaSnapshot: '99.0000',
        score: '0.650000',
        value: '65.35',
        calculatedAt: new Date('2026-09-15T22:30:00Z'),
      });

      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-09-15`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe(65.35);
      expect(res.body.calculatedAt).toBe(quoteSameDay.calculatedAt.toISOString());
    });

    it('cotización de martes sigue vigente el miércoles si el miércoles no hubo recálculo', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      // Martes 2026-09-15
      const tuesdayQuote = await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        score: '0.700000',
        value: '70.30',
        calculatedAt: new Date('2026-09-15T14:00:00Z'),
      });

      // Consultar Miércoles 2026-09-16 (sin recálculo)
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-09-16`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe(70.30);
      expect(res.body.calculatedAt).toBe(tuesdayQuote.calculatedAt.toISOString());
    });
  });
});

import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { ValuationStrategyEntity } from '../../src/repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../src/repositories/quotation/entities/player-quote.entity';
import { createTestApp, TestContext } from '../test-app';

describe('GET /players/:id/quote?at= (e2e, spec 013 - US2 Cotización histórica)', () => {
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
    testApiKey = await registerLoginAndIssueApiKey('quote-at-date-e2e@mail.com');
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
        externalId: 'ext-at-date-1',
        name: 'Jugador At Date',
        league: 'La Liga',
        team: 'Atlético de Madrid',
        position: 'MF',
        matchesPlayed: 15,
        passesCompleted: 120,
        shots: 10,
        interceptions: 8,
        rating: 7.5,
        goals: 3,
        assists: 5,
        keyPasses: 20,
        dribbles: 12,
        totalTackles: 30,
        yellowCards: 2,
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
        name: 'Estrategia At Date Test',
        weights: { goals: 0.5, assists: 0.5 },
        factorEscala: '99.0000',
        isActive: true,
      });
    }
  });

  describe('Validación del parámetro at', () => {
    it('"at" con formato inválido → 400 Bad Request', async () => {
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=hola`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(400);
    });

    it('"at" con fecha inexistente (2026-02-30) → 400 Bad Request', async () => {
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-02-30`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(400);
    });

    it('"at" con formato incorrecto (2026/09/15) → 400 Bad Request', async () => {
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026/09/15`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(400);
    });
  });

  describe('Semántica de fecha histórica', () => {
    it('retorna la cotización vigente en la fecha solicitada (calculatedAt ≤ fin del día)', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      // Cotización del 10 de septiembre
      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.4, assists: 0.6 },
        factorEscalaSnapshot: '99.0000',
        score: '0.400000',
        value: '40.60',
        calculatedAt: new Date('2026-09-10T12:00:00Z'),
      });

      // Cotización del 20 de septiembre (más reciente)
      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.6, assists: 0.4 },
        factorEscalaSnapshot: '99.0000',
        score: '0.712345',
        value: '71.52',
        calculatedAt: new Date('2026-09-20T15:00:00Z'),
      });

      // Consultar al 15 de septiembre: debe devolver la del 10 (la del 20 no está vigente aún)
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-09-15`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe(40.6);
      expect(res.body.weights).toEqual({ goals: 0.4, assists: 0.6 });
    });

    it('retorna la cotización del mismo día si calculatedAt cae exactamente ese día', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        score: '0.550000',
        value: '55.45',
        calculatedAt: new Date('2026-09-15T10:00:00Z'),
      });

      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-09-15`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe(55.45);
    });

    it('retorna 204 cuando todas las cotizaciones son posteriores a la fecha solicitada', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        score: '0.500000',
        value: '50.50',
        calculatedAt: new Date('2026-10-01T09:00:00Z'),
      });

      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-09-15`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('devuelve la más reciente de varias cotizaciones dentro del rango', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.3, assists: 0.7 },
        factorEscalaSnapshot: '99.0000',
        score: '0.300000',
        value: '30.70',
        calculatedAt: new Date('2026-09-05T08:00:00Z'),
      });

      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        score: '0.550000',
        value: '55.45',
        calculatedAt: new Date('2026-09-12T14:00:00Z'),
      });

      // Cotización fuera del rango
      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.7, assists: 0.3 },
        factorEscalaSnapshot: '99.0000',
        score: '0.700000',
        value: '70.30',
        calculatedAt: new Date('2026-09-20T10:00:00Z'),
      });

      // at=2026-09-15: dentro del rango están las del 5 y 12; debe devolver la del 12
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-09-15`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe(55.45);
    });
  });

  describe('Campos de la respuesta', () => {
    it('la respuesta 200 incluye todos los campos requeridos por el contrato', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        score: '0.712345',
        value: '71.52',
        calculatedAt: new Date('2026-09-10T10:00:00Z'),
      });

      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote?at=2026-09-15`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        playerId: testPlayer.id,
        valor: 71.52,
        score: 0.712345,
        strategyName: testStrategy.name,
        weights: { goals: 0.5, assists: 0.5 },
      });
      expect(typeof res.body.calculatedAt).toBe('string');
      expect(new Date(res.body.calculatedAt).toISOString()).toBe(res.body.calculatedAt);
    });
  });
});

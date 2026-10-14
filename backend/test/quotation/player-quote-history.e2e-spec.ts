import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { ValuationStrategyEntity } from '../../src/repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../src/repositories/quotation/entities/player-quote.entity';
import { createTestApp, TestContext } from '../test-app';

/**
 * No confundir con player-quote-historical.e2e-spec.ts (spec 013, US2: consulta
 * puntual a una fecha vía ?at=). Esta spec cubre el listado completo del
 * historial (015-player-quote-history).
 */
describe('GET /players/:id/quotes (e2e, spec 015 - Historial completo)', () => {
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
    testApiKey = await registerLoginAndIssueApiKey('quote-history-e2e@mail.com');
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
        externalId: 'ext-test-history-1',
        name: 'Jugador Test Historial',
        league: 'La Liga',
        team: 'Real Madrid',
        position: 'FW',
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
        name: 'Estrategia Test Historial',
        weights: { goals: 0.5, assists: 0.5 },
        factorEscala: '99.0000',
        isActive: true,
      });
    }
  });

  describe('Autenticación', () => {
    it('sin x-api-key → 401 Unauthorized', async () => {
      const res = await request(server()).get(`/players/${testPlayer.id}/quotes`);
      expect(res.status).toBe(401);
    });
  });

  describe('Validación de existencia de jugador', () => {
    it('jugador inexistente → 404 Not Found con PLAYER_NOT_FOUND', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(server())
        .get(`/players/${nonExistentId}/quotes`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('No se encontró el jugador solicitado');
    });
  });

  describe('Consulta del historial completo', () => {
    it('jugador existe pero no tiene cotizaciones → 200 OK con array vacío (no 404)', async () => {
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quotes`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('jugador con varias cotizaciones → 200 OK ordenado ascendente por calculatedAt', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      // Insertar fuera de orden a propósito para verificar que el endpoint ordena.
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
      await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        score: '0.500000',
        value: '50.50',
        calculatedAt: new Date('2026-09-10T12:00:00Z'),
      });

      const res = await request(server())
        .get(`/players/${testPlayer.id}/quotes`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].calculatedAt).toBe('2026-09-10T12:00:00.000Z');
      expect(res.body[1].calculatedAt).toBe('2026-09-20T15:00:00.000Z');
      expect(res.body[0].value).toBe(50.50);
      expect(res.body[1].value).toBe(71.52);
    });
  });
});

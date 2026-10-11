import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { UserEntity } from '../../src/repositories/auth/entities/user.entity';
import { ApiKeyEntity } from '../../src/repositories/api-key/entities/api-key.entity';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { ValuationStrategyEntity } from '../../src/repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../src/repositories/quotation/entities/player-quote.entity';
import { createTestApp, TestContext } from '../test-app';

describe('GET /players/:id/quote (e2e, spec 013 - US1 Última Cotización)', () => {
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
    testApiKey = await registerLoginAndIssueApiKey('quote-latest-e2e@mail.com');
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.dataSource.getRepository(PlayerQuoteEntity).clear();

    const playerRepo = ctx.dataSource.getRepository(PlayerEntity);
    // Obtener un jugador existente del catálogo seeded o crear uno
    const players = await playerRepo.find({ take: 1 });
    if (players.length > 0) {
      testPlayer = players[0];
    } else {
      testPlayer = await playerRepo.save({
        id: randomUUID(),
        externalId: 'ext-test-1',
        name: 'Jugador Test',
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
        name: 'Estrategia Test',
        weights: { goals: 0.5, assists: 0.5 },
        factorEscalaSnapshot: '99.0000',
        factorEscala: '99.0000',
        isActive: true,
      });
    }
  });

  describe('Autenticación', () => {
    it('sin x-api-key → 401 Unauthorized', async () => {
      const res = await request(server()).get(`/players/${testPlayer.id}/quote`);
      expect(res.status).toBe(401);
    });

    it('con x-api-key inválida → 401 Unauthorized', async () => {
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote`)
        .set('x-api-key', 'api_key_invalida_1234567890');
      expect(res.status).toBe(401);
    });
  });

  describe('Validación de existencia de jugador', () => {
    it('jugador inexistente → 404 Not Found con PLAYER_NOT_FOUND', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(server())
        .get(`/players/${nonExistentId}/quote`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('No se encontró el jugador solicitado');
    });
  });

  describe('Consulta de última cotización', () => {
    it('jugador existe pero no tiene cotizaciones → 204 No Content sin cuerpo', async () => {
      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('jugador con cotizaciones → 200 OK con la cotización más reciente', async () => {
      const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);

      // Insertar dos cotizaciones en momentos distintos
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

      const latestQuote = await quoteRepo.save({
        id: randomUUID(),
        playerId: testPlayer.id,
        strategyId: testStrategy.id,
        weightSnapshot: { goals: 0.6, assists: 0.4 },
        factorEscalaSnapshot: '99.0000',
        score: '0.712345',
        value: '71.52',
        calculatedAt: new Date('2026-09-20T15:00:00Z'),
      });

      const res = await request(server())
        .get(`/players/${testPlayer.id}/quote`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body.playerId).toBe(testPlayer.id);
      expect(res.body.valor).toBe(71.52);
      expect(res.body.score).toBe(0.712345);
      expect(res.body.strategyName).toBe(testStrategy.name);
      expect(res.body.weights).toEqual({ goals: 0.6, assists: 0.4 });
      expect(res.body.calculatedAt).toBe(latestQuote.calculatedAt.toISOString());
    });
  });
});

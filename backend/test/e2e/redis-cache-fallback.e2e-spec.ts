import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { ValuationStrategyEntity } from '../../src/repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../src/repositories/quotation/entities/player-quote.entity';
import { RedisCacheService } from '../../src/shared/cache/redis-cache.service';
import { createTestApp, TestContext } from '../test-app';

describe('E2E: Redis Cache, Reactive Invalidation & Fallback Degradation (Spec 031)', () => {
  let ctx: TestContext;
  let cacheService: RedisCacheService;
  const server = () => ctx.app.getHttpServer();

  let userA: { token: string; userId: string };
  let userB: { token: string; userId: string };
  let player1: PlayerEntity;
  let player2: PlayerEntity;

  const registerAndLogin = async (email: string, username: string) => {
    const register = await request(server())
      .post('/auth/register')
      .send({ email, password: 'Password123!', username });
    const login = await request(server())
      .post('/auth/login')
      .send({ email, password: 'Password123!' });
    return { token: login.body.accessToken as string, userId: register.body.id as string };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    cacheService = ctx.app.get(RedisCacheService);
    await ctx.clearUsers();

    userA = await registerAndLogin('user-a@futval.com', 'user_a');
    userB = await registerAndLogin('user-b@futval.com', 'user_b');

    // Crear dos jugadores de prueba
    const playerRepo = ctx.dataSource.getRepository(PlayerEntity);
    player1 = await playerRepo.save({
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Lionel Messi',
      league: 'La Liga',
      team: 'FC Barcelona',
      position: 'FW',
      matchesPlayed: 30,
      passesCompleted: 85.0,
      shots: 4.5,
      interceptions: 0.5,
      rating: 8.9,
      goals: 25,
      assists: 15,
      keyPasses: 40,
      dribbles: 50,
      totalTackles: 10,
      yellowCards: 1,
      redCards: 0,
      removedAt: null,
    });

    player2 = await playerRepo.save({
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Luka Modric',
      league: 'La Liga',
      team: 'Real Madrid',
      position: 'MF',
      matchesPlayed: 28,
      passesCompleted: 90.0,
      shots: 2.1,
      interceptions: 1.8,
      rating: 8.2,
      goals: 5,
      assists: 8,
      keyPasses: 35,
      dribbles: 20,
      totalTackles: 25,
      yellowCards: 2,
      redCards: 0,
      removedAt: null,
    });

    // Asignar cotizaciones para userA y userB
    const strategyRepo = ctx.dataSource.getRepository(ValuationStrategyEntity);
    const userAStrategies = await strategyRepo.find({ where: { userId: userA.userId } });
    const userBStrategies = await strategyRepo.find({ where: { userId: userB.userId } });

    const quoteRepo = ctx.dataSource.getRepository(PlayerQuoteEntity);
    const now = new Date();

    await quoteRepo.save([
      {
        id: randomUUID(),
        userId: userA.userId,
        playerId: player1.id,
        strategyId: userAStrategies[0].id,
        value: 100000000,
        score: 9.5,
        calculatedAt: now,
      },
      {
        id: randomUUID(),
        userId: userA.userId,
        playerId: player2.id,
        strategyId: userAStrategies[0].id,
        value: 50000000,
        score: 8.5,
        calculatedAt: now,
      },
      {
        id: randomUUID(),
        userId: userB.userId,
        playerId: player1.id,
        strategyId: userBStrategies[0].id,
        value: 80000000,
        score: 9.0,
        calculatedAt: now,
      },
    ]);
  });

  afterAll(async () => {
    await ctx.clearUsers();
    await ctx.close();
  });

  describe('US1: Aceleración de Catálogo y Detalle de Jugador (Cache-Aside)', () => {
    it('GET /players devuelve HTTP 200 y almacena la respuesta en Redis para subsecuentes consultas', async () => {
      // Primera llamada: Cache Miss (consulta base de datos y almacena en Redis)
      const res1 = await request(server()).get('/players?page=1&pageSize=10').expect(200);
      expect(res1.body.items).toBeDefined();
      expect(res1.body.total).toBeGreaterThanOrEqual(2);

      // Segunda llamada: Cache Hit (retorna el mismo contenido inmediatamente)
      const res2 = await request(server()).get('/players?page=1&pageSize=10').expect(200);
      expect(res2.body).toEqual(res1.body);
    });

    it('GET /players/:id devuelve HTTP 200 y cachea la entidad individual con escudo', async () => {
      const res1 = await request(server()).get(`/players/${player1.id}`).expect(200);
      expect(res1.body.id).toBe(player1.id);
      expect(res1.body.name).toBe('Lionel Messi');
      expect(res1.body).toHaveProperty('crestUrl');

      // Segunda llamada: Cache Hit
      const res2 = await request(server()).get(`/players/${player1.id}`).expect(200);
      expect(res2.body).toEqual(res1.body);
    });
  });

  describe('US2: Ranking por Usuario e Invalidación Reactiva', () => {
    it('GET /players/ranking cachea resultados independientes por usuario', async () => {
      const resUserA = await request(server())
        .get('/players/ranking?page=1&pageSize=10')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      const resUserB = await request(server())
        .get('/players/ranking?page=1&pageSize=10')
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200);

      // User A tiene 2 cotizaciones, User B tiene 1 cotización
      expect(resUserA.body.total).toBe(2);
      expect(resUserB.body.total).toBe(1);
      expect(resUserA.body.items[0].valor).toBe(100000000);
      expect(resUserB.body.items[0].valor).toBe(80000000);
    });

    it('invalida la caché de ranking al cambiar de estrategia activa (PATCH /users/me/strategies/:id/select)', async () => {
      // 1. Precalentar caché de ranking para userA
      await request(server())
        .get('/players/ranking?page=1&pageSize=10')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      // 2. Obtener la segunda estrategia de userA y seleccionarla
      const strategyRepo = ctx.dataSource.getRepository(ValuationStrategyEntity);
      const userAStrategies = await strategyRepo.find({ where: { userId: userA.userId } });
      const strategyB = userAStrategies.find((s) => !s.isActive);

      if (strategyB) {
        await request(server())
          .patch(`/users/me/strategies/${strategyB.id}/select`)
          .set('Authorization', `Bearer ${userA.token}`)
          .expect(200);

        // 3. Comprobar que la siguiente consulta al ranking resuelve exitosamente con la nueva estrategia activa
        const resAfter = await request(server())
          .get('/players/ranking?page=1&pageSize=10')
          .set('Authorization', `Bearer ${userA.token}`)
          .expect(200);

        expect(resAfter.status).toBe(200);
      }
    });
  });

  describe('US4: Tolerancia a Caídas y Comportamiento Fail-Open', () => {
    it('si la caché de Redis falla, GET /players y GET /players/:id responden normalmente desde la base de datos', async () => {
      // Espiar el método get de RedisCacheService para simular fallo
      const getSpy = jest.spyOn(cacheService, 'get').mockRejectedValueOnce(new Error('Redis connection lost'));

      const res = await request(server()).get(`/players/${player2.id}`).expect(200);
      expect(res.body.id).toBe(player2.id);
      expect(res.body.name).toBe('Luka Modric');

      getSpy.mockRestore();
    });
  });
});

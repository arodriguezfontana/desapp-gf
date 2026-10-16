import * as request from 'supertest';
import { PlayerQuoteEntity } from '../../src/repositories/quotation/entities/player-quote.entity';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { createTestApp, TestContext } from '../test-app';

describe('Estrategias propias por usuario y recálculo manual (e2e, 019-per-user-valuation-strategies)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async (email: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!', username: 'test-user' });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    return login.body.accessToken as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    // DELETE, no .clear() (TRUNCATE): player_quotes y valuation_strategies
    // tienen FK hacia users (019-per-user-valuation-strategies), y TRUNCATE
    // rechaza una tabla referenciada por FK sin CASCADE. El orden respeta las
    // dependencias (hijos antes que padres).
    await ctx.dataSource.query('DELETE FROM "player_quotes"');
    await ctx.dataSource.query('DELETE FROM "valuation_strategies"');
    await ctx.dataSource.query('DELETE FROM "api_keys"');
    await ctx.dataSource.query('DELETE FROM "users"');
  });

  // ---- Historia 1: provisioning automático al alta --------------------------

  describe('al registrarse', () => {
    it('el usuario recibe automáticamente sus dos estrategias, una seleccionada', async () => {
      const token = await registerAndLogin('user1@mail.com');

      const res = await request(server())
        .get('/users/me/strategies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.strategies).toHaveLength(2);
      const names = res.body.strategies.map((s: { name: string }) => s.name).sort();
      expect(names).toEqual(['Impacto táctico', 'Performance general']);
      const selectedCount = res.body.strategies.filter((s: { isSelected: boolean }) => s.isSelected).length;
      expect(selectedCount).toBe(1);
    });

    it('dos usuarios distintos tienen pares de estrategias independientes', async () => {
      const tokenA = await registerAndLogin('user-a@mail.com');
      const tokenB = await registerAndLogin('user-b@mail.com');

      const resA = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${tokenA}`);
      const resB = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${tokenB}`);

      const idsA = resA.body.strategies.map((s: { id: string }) => s.id);
      const idsB = resB.body.strategies.map((s: { id: string }) => s.id);
      expect(idsA.some((id: string) => idsB.includes(id))).toBe(false);
    });
  });

  // ---- Historia 2: listar y seleccionar --------------------------------------

  describe('PATCH /users/me/strategies/:id/select', () => {
    it('sin JWT → 401', async () => {
      const res = await request(server()).patch('/users/me/strategies/some-id/select');
      expect(res.status).toBe(401);
    });

    it('selecciona la otra estrategia propia y desmarca la anterior', async () => {
      const token = await registerAndLogin('select-ok@mail.com');
      const list = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${token}`);
      const notSelected = list.body.strategies.find((s: { isSelected: boolean }) => !s.isSelected);

      const res = await request(server())
        .patch(`/users/me/strategies/${notSelected.id}/select`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isSelected).toBe(true);

      const after = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${token}`);
      expect(after.body.strategies.filter((s: { isSelected: boolean }) => s.isSelected)).toHaveLength(1);
    });

    it('intentar seleccionar la estrategia de otro usuario → 403', async () => {
      const tokenA = await registerAndLogin('owner-select@mail.com');
      const tokenB = await registerAndLogin('intruder-select@mail.com');
      const listA = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${tokenA}`);
      const strategyOfA = listA.body.strategies[0].id;

      const res = await request(server())
        .patch(`/users/me/strategies/${strategyOfA}/select`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
    });
  });

  // ---- Historia 3: editar pesos ----------------------------------------------

  describe('PATCH /users/me/strategies/:id/weights', () => {
    it('suma 1.0 → 200 y persiste', async () => {
      const token = await registerAndLogin('weights-ok@mail.com');
      const list = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${token}`);
      const strategyId = list.body.strategies[0].id;

      const res = await request(server())
        .patch(`/users/me/strategies/${strategyId}/weights`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weights: { goals: 0.5, assists: 0.5 } });

      expect(res.status).toBe(200);
      expect(res.body.weights).toEqual({ goals: 0.5, assists: 0.5 });
    });

    it('suma fuera de tolerancia → 422, sin persistir cambios parciales', async () => {
      const token = await registerAndLogin('weights-bad@mail.com');
      const list = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${token}`);
      const strategy = list.body.strategies[0];

      const res = await request(server())
        .patch(`/users/me/strategies/${strategy.id}/weights`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weights: { goals: 0.9, assists: 0.9 } });

      expect(res.status).toBe(422);

      const after = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${token}`);
      const unchanged = after.body.strategies.find((s: { id: string }) => s.id === strategy.id);
      expect(unchanged.weights).toEqual(strategy.weights);
    });

    it('editar la estrategia de otro usuario → 403', async () => {
      const tokenA = await registerAndLogin('owner-weights@mail.com');
      const tokenB = await registerAndLogin('intruder-weights@mail.com');
      const listA = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${tokenA}`);
      const strategyOfA = listA.body.strategies[0].id;

      const res = await request(server())
        .patch(`/users/me/strategies/${strategyOfA}/weights`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ weights: { goals: 0.5, assists: 0.5 } });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /users/me/strategies/:id/position-weights/:position', () => {
    it('posición inválida → 400', async () => {
      const token = await registerAndLogin('posweights-bad@mail.com');
      const list = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${token}`);
      const strategyId = list.body.strategies[0].id;

      const res = await request(server())
        .patch(`/users/me/strategies/${strategyId}/position-weights/XX`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weights: { rating: 1.0 } });

      expect(res.status).toBe(400);
    });

    it('posición válida con suma 1.0 → 200, actualiza solo ese perfil', async () => {
      const token = await registerAndLogin('posweights-ok@mail.com');
      const list = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${token}`);
      const strategy = list.body.strategies[0];

      const res = await request(server())
        .patch(`/users/me/strategies/${strategy.id}/position-weights/GK`)
        .set('Authorization', `Bearer ${token}`)
        .send({ weights: { rating: 1.0 } });

      expect(res.status).toBe(200);
      expect(res.body.positionWeights.GK).toEqual({ rating: 1.0 });
      expect(res.body.weights).toEqual(strategy.weights);
    });
  });

  // ---- Historia 4: valuación al vuelo ----------------------------------------

  describe('GET /players/:id/valuation', () => {
    it('sin JWT → 401', async () => {
      const player = await ctx.dataSource.getRepository(PlayerEntity).findOne({ where: {} });
      if (!player) return;
      const res = await request(server()).get(`/players/${player.id}/valuation`);
      expect(res.status).toBe(401);
    });

    it('calcula sin persistir, usando la estrategia seleccionada por defecto', async () => {
      const token = await registerAndLogin('valuation-ok@mail.com');
      const player = await ctx.dataSource.getRepository(PlayerEntity).findOne({ where: {} });
      if (!player) return;

      const before = await ctx.dataSource.getRepository(PlayerQuoteEntity).count();
      const res = await request(server())
        .get(`/players/${player.id}/valuation`)
        .set('Authorization', `Bearer ${token}`);
      const after = await ctx.dataSource.getRepository(PlayerQuoteEntity).count();

      expect(res.status).toBe(200);
      expect(typeof res.body.value).toBe('number');
      expect(after).toBe(before);
    });

    it('strategyId ajeno por query → 403', async () => {
      const tokenA = await registerAndLogin('valuation-owner@mail.com');
      const tokenB = await registerAndLogin('valuation-intruder@mail.com');
      const listA = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${tokenA}`);
      const strategyOfA = listA.body.strategies[0].id;
      const player = await ctx.dataSource.getRepository(PlayerEntity).findOne({ where: {} });
      if (!player) return;

      const res = await request(server())
        .get(`/players/${player.id}/valuation?strategyId=${strategyOfA}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
    });

    it('jugador inexistente → 404', async () => {
      const token = await registerAndLogin('valuation-404@mail.com');
      const res = await request(server())
        .get('/players/00000000-0000-0000-0000-000000000000/valuation')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  // ---- Historia 5: recálculo manual ------------------------------------------

  describe('POST /users/me/quotes/recalculate', () => {
    it('sin JWT → 401', async () => {
      const res = await request(server()).post('/users/me/quotes/recalculate');
      expect(res.status).toBe(401);
    });

    it('sin playerId → 200, persiste una cotización por jugador del usuario', async () => {
      const token = await registerAndLogin('recalc-bulk@mail.com');

      const res = await request(server())
        .post('/users/me/quotes/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.recalculated)).toBe(true);
    });

    it('un segundo recálculo del mismo usuario mientras el primero está en curso → 409', async () => {
      const token = await registerAndLogin('recalc-conflict@mail.com');

      // Un catálogo vacío hace que el recálculo masivo termine casi
      // instantáneamente, sin ventana real para que el segundo request
      // alcance a chocar con el lock (el guard JWT del segundo ya tardó más
      // que todo el recálculo del primero). Se siembra un lote de jugadores
      // para que el recálculo tome tiempo real y la carrera sea genuina.
      const { randomUUID } = await import('node:crypto');
      const playerRepo = ctx.dataSource.getRepository(PlayerEntity);
      await playerRepo.insert(
        Array.from({ length: 300 }, (_, i) => ({
          id: randomUUID(),
          externalId: `ext-conflict-${i}`,
          name: `Jugador Conflicto ${i}`,
          league: 'La Liga',
          team: 'Equipo Conflicto',
          position: 'MF',
          rating: 7,
        })),
      );

      const [first, second] = await Promise.all([
        request(server()).post('/users/me/quotes/recalculate').set('Authorization', `Bearer ${token}`).send({}),
        request(server()).post('/users/me/quotes/recalculate').set('Authorization', `Bearer ${token}`).send({}),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    it('playerId inexistente → 404', async () => {
      const token = await registerAndLogin('recalc-404@mail.com');

      const res = await request(server())
        .post('/users/me/quotes/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .send({ playerId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
    });
  });

  // ---- Historia 6: historial propio -------------------------------------------

  describe('GET /players/:id/quotes', () => {
    it('vacío si el usuario nunca recalculó ese jugador', async () => {
      const token = await registerAndLogin('history-empty@mail.com');
      const player = await ctx.dataSource.getRepository(PlayerEntity).findOne({ where: {} });
      if (!player) return;

      const res = await request(server())
        .get(`/players/${player.id}/quotes`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('cada usuario ve únicamente las cotizaciones que él mismo generó', async () => {
      const tokenA = await registerAndLogin('history-a@mail.com');
      const tokenB = await registerAndLogin('history-b@mail.com');
      const player = await ctx.dataSource.getRepository(PlayerEntity).findOne({ where: {} });
      if (!player) return;

      await request(server())
        .post('/users/me/quotes/recalculate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ playerId: player.id });
      await request(server())
        .post('/users/me/quotes/recalculate')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ playerId: player.id });

      const historyA = await request(server()).get(`/players/${player.id}/quotes`).set('Authorization', `Bearer ${tokenA}`);
      const historyB = await request(server()).get(`/players/${player.id}/quotes`).set('Authorization', `Bearer ${tokenB}`);

      expect(historyA.body).toHaveLength(1);
      expect(historyB.body).toHaveLength(1);
    });
  });
});

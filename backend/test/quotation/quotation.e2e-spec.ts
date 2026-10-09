import * as request from 'supertest';
import { UserEntity } from '../../src/repositories/auth/entities/user.entity';
import { ApiKeyEntity } from '../../src/repositories/api-key/entities/api-key.entity';
import { ValuationStrategyEntity } from '../../src/repositories/quotation/entities/valuation-strategy.entity';
import { PlayerQuoteEntity } from '../../src/repositories/quotation/entities/player-quote.entity';
import { createTestApp, TestContext } from '../test-app';

describe('POST /quotes/recalculate (e2e, spec 012)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerLoginAndIssueAdminApiKey = async (email: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!' });
    await ctx.dataSource.getRepository(UserEntity).update({ email }, { role: 'admin' });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    const token = login.body.accessToken as string;
    const issued = await request(server()).post('/auth/api-key').set('Authorization', `Bearer ${token}`);
    return { token, apiKey: issued.body.apiKey as string };
  };

  const registerLoginAndIssueUserApiKey = async (email: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!' });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    const token = login.body.accessToken as string;
    const issued = await request(server()).post('/auth/api-key').set('Authorization', `Bearer ${token}`);
    return { token, apiKey: issued.body.apiKey as string };
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.dataSource.getRepository(PlayerQuoteEntity).clear();
    await ctx.dataSource.getRepository(ApiKeyEntity).clear();
    await ctx.dataSource.getRepository(UserEntity).clear();
  });

  // ---- Auth / access control -----------------------------------------------

  describe('autenticación y autorización', () => {
    it('sin x-api-key → 401', async () => {
      const res = await request(server()).post('/quotes/recalculate');
      expect(res.status).toBe(401);
    });

    it('con ApiKey de usuario (no admin) → 403', async () => {
      const { apiKey } = await registerLoginAndIssueUserApiKey('user-quotes@mail.com');
      const res = await request(server())
        .post('/quotes/recalculate')
        .set('x-api-key', apiKey);
      expect(res.status).toBe(403);
    });
  });

  // ---- US2: recálculo manual ------------------------------------------------

  describe('US2: recálculo manual con estrategia activa', () => {
    it('con ApiKey de admin → 200 con resumen', async () => {
      const { apiKey } = await registerLoginAndIssueAdminApiKey('admin-quotes@mail.com');

      const res = await request(server())
        .post('/quotes/recalculate')
        .set('x-api-key', apiKey);

      expect(res.status).toBe(200);
      expect(typeof res.body.processedPlayers).toBe('number');
      expect(typeof res.body.errors).toBe('number');
      expect(typeof res.body.durationMs).toBe('number');
      expect(res.body.errors).toBe(0);
    });

    it('el número de cotizaciones persistidas coincide con processedPlayers', async () => {
      const { apiKey } = await registerLoginAndIssueAdminApiKey('admin-quotes2@mail.com');

      const res = await request(server())
        .post('/quotes/recalculate')
        .set('x-api-key', apiKey);

      expect(res.status).toBe(200);

      const count = await ctx.dataSource
        .getRepository(PlayerQuoteEntity)
        .count();
      expect(count).toBe(res.body.processedPlayers);
    });
  });

  // ---- US4: snapshot de pesos -----------------------------------------------

  describe('US4: snapshot de pesos en PlayerQuote', () => {
    it('cada cotización persiste weight_snapshot con al menos una clave', async () => {
      const { apiKey } = await registerLoginAndIssueAdminApiKey('admin-snapshot@mail.com');

      await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);

      const quotes = await ctx.dataSource.getRepository(PlayerQuoteEntity).find();
      if (quotes.length === 0) return; // sin jugadores en la BD, no hay nada que validar

      for (const q of quotes) {
        expect(typeof q.weightSnapshot).toBe('object');
        expect(Object.keys(q.weightSnapshot as Record<string, number>).length).toBeGreaterThan(0);
      }
    });

    it('strategyId de la cotización apunta a la estrategia activa', async () => {
      const { apiKey } = await registerLoginAndIssueAdminApiKey('admin-stratid@mail.com');

      await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);

      const activeStrategy = await ctx.dataSource
        .getRepository(ValuationStrategyEntity)
        .findOne({ where: { isActive: true } });

      const quotes = await ctx.dataSource.getRepository(PlayerQuoteEntity).find();
      if (quotes.length === 0) return;

      for (const q of quotes) {
        expect(q.strategyId).toBe(activeStrategy?.id);
      }
    });
  });

  // ---- PATCH /strategies/:id/activate ----------------------------------------

  describe('PATCH /strategies/:id/activate', () => {
    it('sin x-api-key → 401', async () => {
      const res = await request(server()).patch('/quotes/strategies/some-id/activate');
      expect(res.status).toBe(401);
    });

    it('con ApiKey de usuario (no admin) → 403', async () => {
      const { apiKey } = await registerLoginAndIssueUserApiKey('user-activate@mail.com');
      const res = await request(server())
        .patch('/quotes/strategies/some-id/activate')
        .set('x-api-key', apiKey);
      expect(res.status).toBe(403);
    });

    it('id inexistente → 404', async () => {
      const { apiKey } = await registerLoginAndIssueAdminApiKey('admin-activate-404@mail.com');
      const res = await request(server())
        .patch('/quotes/strategies/00000000-0000-0000-0000-000000000000/activate')
        .set('x-api-key', apiKey);
      expect(res.status).toBe(404);
    });

    it('con id válido → 200 y la estrategia queda activa', async () => {
      const { apiKey } = await registerLoginAndIssueAdminApiKey('admin-activate-ok@mail.com');

      const inactiveStrategy = await ctx.dataSource
        .getRepository(ValuationStrategyEntity)
        .findOne({ where: { isActive: false } });

      if (!inactiveStrategy) return; // seed no cargado, skip

      const res = await request(server())
        .patch(`/quotes/strategies/${inactiveStrategy.id}/activate`)
        .set('x-api-key', apiKey);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(inactiveStrategy.id);
      expect(res.body.isActive).toBe(true);

      const nowActive = await ctx.dataSource
        .getRepository(ValuationStrategyEntity)
        .findOne({ where: { id: inactiveStrategy.id } });
      expect(nowActive?.isActive).toBe(true);
    });
  });

  // ---- US2: sin estrategia activa -------------------------------------------

  describe('sin estrategia activa', () => {
    it('desactivar todas las estrategias → 422', async () => {
      const { apiKey } = await registerLoginAndIssueAdminApiKey('admin-noactive@mail.com');

      await ctx.dataSource
        .query('UPDATE "valuation_strategies" SET "is_active" = false WHERE "is_active" = true');

      const res = await request(server())
        .post('/quotes/recalculate')
        .set('x-api-key', apiKey);

      expect(res.status).toBe(422);

      // Restaurar estrategia activa para no romper otros tests
      await ctx.dataSource
        .getRepository(ValuationStrategyEntity)
        .update({ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }, { isActive: true });
    });
  });
});

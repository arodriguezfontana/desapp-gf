import * as request from 'supertest';
import { createTestApp, TestContext } from '../test-app';

describe('Método de valuación de una estrategia (e2e, spec 027)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async (email: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!', username: 'test-user' });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    return login.body.accessToken as string;
  };

  const listStrategies = async (token: string) => {
    const res = await request(server()).get('/users/me/strategies').set('Authorization', `Bearer ${token}`);
    return res.body.strategies as Array<{ id: string; method: string }>;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.dataSource.query('DELETE FROM "player_quotes"');
    await ctx.dataSource.query('DELETE FROM "valuation_strategies"');
    await ctx.dataSource.query('DELETE FROM "api_keys"');
    await ctx.dataSource.query('DELETE FROM "users"');
  });

  it('las estrategias nuevas arrancan con el método WEIGHTED', async () => {
    const token = await registerAndLogin('method-default@mail.com');

    const strategies = await listStrategies(token);

    expect(strategies).toHaveLength(2);
    expect(strategies.every((s) => s.method === 'WEIGHTED')).toBe(true);
  });

  describe('PATCH /users/me/strategies/:id/method', () => {
    it('sin JWT → 401', async () => {
      const res = await request(server()).patch('/users/me/strategies/some-id/method').send({ method: 'PER_MATCH' });
      expect(res.status).toBe(401);
    });

    it('método válido → 200 y persiste solo en esa estrategia', async () => {
      const token = await registerAndLogin('method-ok@mail.com');
      const [first, second] = await listStrategies(token);

      const res = await request(server())
        .patch(`/users/me/strategies/${first.id}/method`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'PER_MATCH' });

      expect(res.status).toBe(200);
      expect(res.body.method).toBe('PER_MATCH');
      const after = await listStrategies(token);
      expect(after.find((s) => s.id === first.id)?.method).toBe('PER_MATCH');
      expect(after.find((s) => s.id === second.id)?.method).toBe('WEIGHTED');
    });

    it('método inválido → 400 y no cambia nada', async () => {
      const token = await registerAndLogin('method-invalid@mail.com');
      const [first] = await listStrategies(token);

      const res = await request(server())
        .patch(`/users/me/strategies/${first.id}/method`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'RANDOM' });

      expect(res.status).toBe(400);
      const after = await listStrategies(token);
      expect(after.find((s) => s.id === first.id)?.method).toBe('WEIGHTED');
    });

    it('estrategia de otro usuario → 403', async () => {
      const owner = await registerAndLogin('method-owner@mail.com');
      const intruder = await registerAndLogin('method-intruder@mail.com');
      const [ownerStrategy] = await listStrategies(owner);

      const res = await request(server())
        .patch(`/users/me/strategies/${ownerStrategy.id}/method`)
        .set('Authorization', `Bearer ${intruder}`)
        .send({ method: 'PER_MATCH' });

      expect(res.status).toBe(403);
    });

    it('estrategia inexistente → 404', async () => {
      const token = await registerAndLogin('method-missing@mail.com');

      const res = await request(server())
        .patch('/users/me/strategies/00000000-0000-4000-8000-000000000000/method')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'PER_MATCH' });

      expect(res.status).toBe(404);
    });
  });
});

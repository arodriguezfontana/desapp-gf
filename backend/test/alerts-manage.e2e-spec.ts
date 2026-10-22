import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { createTestApp, TestContext } from './test-app';

/**
 * GET /alerts, DELETE /alerts/:id (025-player-price-alerts, contracts/alerts-api.md,
 * spec FR-005..FR-008).
 */
describe('GET /alerts, DELETE /alerts/:id (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async (email: string) => {
    await request(server())
      .post('/auth/register')
      .send({ email, password: 'Abcd1234!', username: email.split('@')[0] });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    return login.body.accessToken as string;
  };

  const insertPlayer = async (): Promise<PlayerEntity> => {
    const player: Partial<PlayerEntity> = {
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Jugador Alertas',
      league: 'La Liga',
      team: 'Alertas FC',
      position: 'FW',
      rating: 7,
    };
    await ctx.dataSource.getRepository(PlayerEntity).save(player);
    return player as PlayerEntity;
  };

  const createAlert = async (token: string, playerId: string) => {
    const res = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId, condition: 'PRICE_BELOW', targetValue: 10 });
    return res.body.id as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.dataSource.query('DELETE FROM "notifications"');
    await ctx.dataSource.query('DELETE FROM "price_alerts"');
    await ctx.clearUsers();
    // DELETE, no .clear() (TRUNCATE): price_alerts/notifications tienen FK
    // hacia players (025-player-price-alerts) y TRUNCATE rechaza cualquier
    // tabla referenciada por una FK aunque esa tabla ya esté vacía.
    await ctx.dataSource.query('DELETE FROM "players"');
  });

  it('GET /alerts devuelve únicamente las alertas propias', async () => {
    const player = await insertPlayer();
    const tokenA = await registerAndLogin('manage1@mail.com');
    const tokenB = await registerAndLogin('manage2@mail.com');
    await createAlert(tokenA, player.id);
    await createAlert(tokenB, player.id);

    const resA = await request(server()).get('/alerts').set('Authorization', `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body).toHaveLength(1);
  });

  it('DELETE /alerts/:id sobre una alerta propia la cancela (204)', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('manage3@mail.com');
    const alertId = await createAlert(token, player.id);

    const del = await request(server()).delete(`/alerts/${alertId}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const list = await request(server()).get('/alerts').set('Authorization', `Bearer ${token}`);
    expect(list.body.find((a: { id: string }) => a.id === alertId).status).toBe('CANCELLED');
  });

  it('DELETE /alerts/:id sobre una alerta de otro usuario devuelve 404', async () => {
    const player = await insertPlayer();
    const tokenOwner = await registerAndLogin('manage4@mail.com');
    const tokenOther = await registerAndLogin('manage5@mail.com');
    const alertId = await createAlert(tokenOwner, player.id);

    const res = await request(server())
      .delete(`/alerts/${alertId}`)
      .set('Authorization', `Bearer ${tokenOther}`);

    expect(res.status).toBe(404);
  });

  it('401 sin JWT en ambos endpoints', async () => {
    const resList = await request(server()).get('/alerts');
    const resDelete = await request(server()).delete(`/alerts/${randomUUID()}`);

    expect(resList.status).toBe(401);
    expect(resDelete.status).toBe(401);
  });
});

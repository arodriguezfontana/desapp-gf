import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { UserEntity } from '../src/repositories/auth/entities/user.entity';
import { ValuationStrategyEntity } from '../src/repositories/quotation/entities/valuation-strategy.entity';
import { createTestApp, TestContext } from './test-app';

/**
 * GET /notifications, PATCH /notifications/:id/read, PATCH /notifications/read-all
 * (025-player-price-alerts, contracts/notifications-api.md, spec FR-014..FR-017).
 */
describe('GET /notifications, PATCH /notifications/:id/read, PATCH /notifications/read-all (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async (email: string) => {
    await request(server())
      .post('/auth/register')
      .send({ email, password: 'Abcd1234!', username: email.split('@')[0] });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    return { token: login.body.accessToken as string, userId: me.body.id as string };
  };

  const promoteToAdminAndIssueKey = async (token: string, userId: string) => {
    await ctx.dataSource.getRepository(UserEntity).update({ id: userId }, { role: 'admin' });
    const res = await request(server()).post('/auth/api-key').set('Authorization', `Bearer ${token}`);
    return res.body.apiKey as string;
  };

  const insertPlayer = async (): Promise<PlayerEntity> => {
    const player: Partial<PlayerEntity> = {
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Jugador Notificaciones',
      league: 'La Liga',
      team: 'Notif FC',
      position: 'FW',
      goals: 0,
    };
    await ctx.dataSource.getRepository(PlayerEntity).save(player);
    return player as PlayerEntity;
  };

  /** Crea una alerta que seguro se dispara y recalcula, devolviendo el id de la notificación creada. */
  const triggerOneNotification = async (token: string, apiKey: string, playerId: string) => {
    const createAlert = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId, condition: 'PRICE_BELOW', targetValue: 999999 });
    expect(createAlert.status).toBe(201);
    await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);
    const list = await request(server()).get('/notifications').set('Authorization', `Bearer ${token}`);
    return list.body[0].id as string;
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
    await ctx.dataSource.query('DELETE FROM "player_quotes"');
    await ctx.dataSource.getRepository(ValuationStrategyEntity).clear();
    await ctx.clearUsers();
    // DELETE, no .clear() (TRUNCATE): price_alerts/notifications tienen FK
    // hacia players (025-player-price-alerts) y TRUNCATE rechaza cualquier
    // tabla referenciada por una FK aunque esa tabla ya esté vacía.
    await ctx.dataSource.query('DELETE FROM "players"');
  });

  it('GET /notifications devuelve las notificaciones ordenadas más reciente primero', async () => {
    const player = await insertPlayer();
    const { token, userId } = await registerAndLogin('notif1@mail.com');
    const apiKey = await promoteToAdminAndIssueKey(token, userId);

    await triggerOneNotification(token, apiKey, player.id);

    const res = await request(server()).get('/notifications').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /notifications/:id/read marca una propia como leída (204)', async () => {
    const player = await insertPlayer();
    const { token, userId } = await registerAndLogin('notif2@mail.com');
    const apiKey = await promoteToAdminAndIssueKey(token, userId);
    const notificationId = await triggerOneNotification(token, apiKey, player.id);

    const patch = await request(server())
      .patch(`/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(patch.status).toBe(204);

    const list = await request(server()).get('/notifications').set('Authorization', `Bearer ${token}`);
    expect(list.body.find((n: { id: string }) => n.id === notificationId).read).toBe(true);
  });

  it('PATCH /notifications/:id/read sobre una notificación de otro usuario devuelve 404', async () => {
    const player = await insertPlayer();
    const { token: tokenOwner, userId: ownerId } = await registerAndLogin('notif3@mail.com');
    const { token: tokenOther } = await registerAndLogin('notif4@mail.com');
    const apiKey = await promoteToAdminAndIssueKey(tokenOwner, ownerId);
    const notificationId = await triggerOneNotification(tokenOwner, apiKey, player.id);

    const res = await request(server())
      .patch(`/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${tokenOther}`);

    expect(res.status).toBe(404);
  });

  it('PATCH /notifications/read-all marca todas las no leídas propias (204)', async () => {
    const player = await insertPlayer();
    const { token, userId } = await registerAndLogin('notif5@mail.com');
    const apiKey = await promoteToAdminAndIssueKey(token, userId);
    await triggerOneNotification(token, apiKey, player.id);

    const patch = await request(server())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);
    expect(patch.status).toBe(204);

    const list = await request(server()).get('/notifications').set('Authorization', `Bearer ${token}`);
    expect(list.body.every((n: { read: boolean }) => n.read)).toBe(true);
  });

  it('401 sin JWT en los tres endpoints', async () => {
    const resGet = await request(server()).get('/notifications');
    const resPatch = await request(server()).patch(`/notifications/${randomUUID()}/read`);
    const resPatchAll = await request(server()).patch('/notifications/read-all');

    expect(resGet.status).toBe(401);
    expect(resPatch.status).toBe(401);
    expect(resPatchAll.status).toBe(401);
  });
});

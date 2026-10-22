import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { UserEntity } from '../src/repositories/auth/entities/user.entity';
import { ValuationStrategyEntity } from '../src/repositories/quotation/entities/valuation-strategy.entity';
import { createTestApp, TestContext } from './test-app';

/**
 * Flujo completo: POST /quotes/recalculate -> quote.recalculated ->
 * alert.triggered -> Notification persistida visible en GET /notifications
 * (025-player-price-alerts, spec FR-011..FR-013, SC-003).
 */
describe('Disparo de alerta por recálculo -> notificación (e2e)', () => {
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

  const insertPlayer = async (goals: number): Promise<PlayerEntity> => {
    const player: Partial<PlayerEntity> = {
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Jugador Disparo',
      league: 'La Liga',
      team: 'Disparo FC',
      position: 'FW',
      goals,
    };
    await ctx.dataSource.getRepository(PlayerEntity).save(player);
    return player as PlayerEntity;
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

  it('un recálculo que cumple la condición de una alerta activa genera una notificación visible (SC-003)', async () => {
    const player = await insertPlayer(0);
    const { token, userId } = await registerAndLogin('trigger1@mail.com');
    const apiKey = await promoteToAdminAndIssueKey(token, userId);

    // Umbral muy alto para PRICE_BELOW: cualquier cotización inicial lo cumple.
    const createAlert = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 999999 });
    expect(createAlert.status).toBe(201);

    const recalc = await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);
    expect(recalc.status).toBe(200);

    const notifications = await request(server())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(notifications.status).toBe(200);
    expect(notifications.body.length).toBeGreaterThanOrEqual(1);
    const notification = notifications.body.find((n: { playerId: string }) => n.playerId === player.id);
    expect(notification).toBeDefined();
    expect(notification.condition).toBe('PRICE_BELOW');
    expect(notification.read).toBe(false);
    expect(notification.playerName).toBe('Jugador Disparo');
  });

  it('una cotización que no cumple ninguna condición no genera notificación', async () => {
    const player = await insertPlayer(0);
    const { token, userId } = await registerAndLogin('trigger2@mail.com');
    const apiKey = await promoteToAdminAndIssueKey(token, userId);

    // Umbral muy bajo para PRICE_BELOW: ninguna cotización razonable lo cumple.
    await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 0.01 });

    await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);

    const notifications = await request(server())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(notifications.body).toHaveLength(0);
  });

  it('una alerta cancelada antes del recálculo no genera notificación (spec FR-008)', async () => {
    const player = await insertPlayer(0);
    const { token, userId } = await registerAndLogin('trigger3@mail.com');
    const apiKey = await promoteToAdminAndIssueKey(token, userId);

    const createAlert = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 999999 });
    await request(server())
      .delete(`/alerts/${createAlert.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    await request(server()).post('/quotes/recalculate').set('x-api-key', apiKey);

    const notifications = await request(server())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(notifications.body).toHaveLength(0);
  });
});

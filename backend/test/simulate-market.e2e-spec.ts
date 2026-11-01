import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { UserEntity } from '../src/repositories/auth/entities/user.entity';
import { createTestApp, TestContext } from './test-app';

/**
 * E2E de POST /admin/simulate-market: cubre lo que antes solo tenía unit
 * tests con repositorios mockeados (MarketSimulationService nunca había
 * tenido integración ni e2e). Ejercita el flujo real contra Postgres:
 * historial de cotizaciones extendido a todo el catálogo activo, y las
 * alertas de demo sembradas y efectivamente disparadas por la propia
 * simulación (025-player-price-alerts).
 *
 * `simulate()` ignora quién llama al endpoint y opera siempre sobre la
 * cuenta canónica `ADMIN_EMAIL` (sin targetEmail explícito desde el
 * controller): para poder inspeccionar after-the-fact vía /alerts y
 * /notifications (ambos user-scoped por JWT), el usuario autenticado en
 * este test TIENE que ser esa misma cuenta, no una cualquiera promovida a
 * admin.
 */
describe('POST /admin/simulate-market (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  // `MarketSimulationService.simulate()` siempre opera sobre `ADMIN_EMAIL`
  // (sin recibir targetEmail desde el controller): el usuario de este test
  // tiene que tener exactamente ese email para poder inspeccionar sus
  // propias alertas/notificaciones después de simular.
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@desapp.com';

  const registerAdminAndLogin = async () => {
    const password = 'Abcd1234!';
    await request(server())
      .post('/auth/register')
      .send({ email: ADMIN_EMAIL, password, username: 'sim-admin' });
    const login = await request(server()).post('/auth/login').send({ email: ADMIN_EMAIL, password });
    const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    await ctx.dataSource.getRepository(UserEntity).update({ id: me.body.id as string }, { role: 'admin' });
    return { token: login.body.accessToken as string, userId: me.body.id as string };
  };

  const insertPlayer = async (name: string): Promise<PlayerEntity> => {
    const player: Partial<PlayerEntity> = {
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name,
      league: 'La Liga',
      team: 'Simulación FC',
      position: 'FW',
      goals: 5,
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
    await ctx.dataSource.query('DELETE FROM "valuation_strategies"');
    await ctx.dataSource.query('DELETE FROM "token_transactions"');
    await ctx.dataSource.query('DELETE FROM "orders"');
    await ctx.dataSource.query('DELETE FROM "token_holdings"');
    await ctx.clearUsers();
    await ctx.dataSource.query('DELETE FROM "players"');
  });

  it('ejecuta la simulación, siembra y dispara alertas de demo, y extiende el historial de cotizaciones a todo el catálogo activo', async () => {
    // 8 jugadores activos: más que los 6 con actividad de mercado simulada,
    // para probar que el historial de cotizaciones cubre todo el catálogo.
    const players = await Promise.all(
      Array.from({ length: 8 }, (_, i) => insertPlayer(`Jugador Simulado ${i}`)),
    );

    const { token } = await registerAdminAndLogin();

    const sim = await request(server())
      .post('/admin/simulate-market')
      .set('Authorization', `Bearer ${token}`);

    expect(sim.status).toBe(200);
    expect(sim.body.success).toBe(true);
    expect(sim.body.alertsCreated).toBe(2);
    expect(sim.body.quotes).toHaveLength(players.length);
    expect(sim.body.quotesCreated).toBe(players.length * 5);

    // Las alertas de demo quedaron activas y visibles para el admin.
    const alerts = await request(server()).get('/alerts').set('Authorization', `Bearer ${token}`);
    expect(alerts.status).toBe(200);
    expect(alerts.body).toHaveLength(2);
    expect(alerts.body.map((a: { condition: string }) => a.condition).sort()).toEqual([
      'PRICE_ABOVE',
      'PRICE_BELOW',
    ]);

    // Ambas alertas de demo se dispararon con la cotización que generó la
    // propia simulación: dos notificaciones visibles para el admin.
    const notifications = await request(server())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(notifications.status).toBe(200);
    expect(notifications.body.length).toBeGreaterThanOrEqual(2);
    const triggeredAlertIds = new Set(alerts.body.map((a: { id: string }) => a.id));
    const matchingNotifications = notifications.body.filter((n: { alertId: string }) =>
      triggeredAlertIds.has(n.alertId),
    );
    expect(matchingNotifications).toHaveLength(2);

    // El historial de cotizaciones del admin cubre también a un jugador que
    // no participó de la actividad de mercado simulada (índice 7, fuera de
    // los primeros 6), no solo a los que tienen holdings/órdenes.
    const historyOutsideDemo = await request(server())
      .get(`/players/${players[7].id}/quotes`)
      .set('Authorization', `Bearer ${token}`);
    expect(historyOutsideDemo.status).toBe(200);
    expect(historyOutsideDemo.body).toHaveLength(5);
  });

  it('una segunda corrida no vuelve a sembrar alertas de demo (idempotente)', async () => {
    await Promise.all(Array.from({ length: 4 }, (_, i) => insertPlayer(`Jugador Idempotencia ${i}`)));

    const { token } = await registerAdminAndLogin();

    const first = await request(server())
      .post('/admin/simulate-market')
      .set('Authorization', `Bearer ${token}`);
    expect(first.body.alertsCreated).toBe(2);

    const second = await request(server())
      .post('/admin/simulate-market')
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.alertsCreated).toBe(0);

    const alerts = await request(server()).get('/alerts').set('Authorization', `Bearer ${token}`);
    expect(alerts.body).toHaveLength(2);
  });

  it('rechaza la simulación sin un JWT admin (401)', async () => {
    const sim = await request(server()).post('/admin/simulate-market');

    expect(sim.status).toBe(401);
  });
});

import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { createTestApp, TestContext } from './test-app';

/**
 * POST /alerts (025-player-price-alerts, contracts/alerts-api.md, spec FR-001..FR-004).
 */
describe('POST /alerts (e2e)', () => {
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

  it('201: crea la alerta en estado ACTIVE', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('alertuser1@mail.com');

    const res = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 15.5 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.playerId).toBe(player.id);
    expect(res.body.condition).toBe('PRICE_BELOW');
  });

  it('400: umbral negativo', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('alertuser2@mail.com');

    const res = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: -5 });

    expect(res.status).toBe(400);
  });

  it('400: condición inválida', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('alertuser3@mail.com');

    const res = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'NOT_A_CONDITION', targetValue: 10 });

    expect(res.status).toBe(400);
  });

  it('404: jugador inexistente', async () => {
    const token = await registerAndLogin('alertuser4@mail.com');

    const res = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: randomUUID(), condition: 'PRICE_BELOW', targetValue: 10 });

    expect(res.status).toBe(404);
  });

  it('401: sin JWT', async () => {
    const player = await insertPlayer();

    const res = await request(server())
      .post('/alerts')
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 10 });

    expect(res.status).toBe(401);
  });

  it('permite múltiples alertas activas del mismo usuario sobre el mismo jugador (spec FR-003)', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('alertuser5@mail.com');

    const res1 = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 10 });
    const res2 = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'PRICE_ABOVE', targetValue: 20 });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.id).not.toBe(res2.body.id);
  });

  it('409: no permite crear una alerta idéntica (mismo jugador, condición y umbral) a una ya activa', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('alertuser6@mail.com');

    const first = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 10 });
    expect(first.status).toBe(201);

    const duplicate = await request(server())
      .post('/alerts')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id, condition: 'PRICE_BELOW', targetValue: 10 });

    expect(duplicate.status).toBe(409);
  });
});

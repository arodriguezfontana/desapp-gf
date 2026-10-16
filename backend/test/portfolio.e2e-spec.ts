import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { TokenHoldingEntity } from '../src/repositories/portfolio/entities/token-holding.entity';
import { TokenTransactionEntity } from '../src/repositories/orders/entities/token-transaction.entity';
import { createTestApp, TestContext } from './test-app';

/**
 * GET /users/:id/portfolio — portfolio de inversiones del usuario (spec).
 */
describe('GET /users/:id/portfolio (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async (email: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!', username: email.split('@')[0] });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    return { token: login.body.accessToken as string, userId: me.body.id as string };
  };

  const insertPlayer = async (): Promise<PlayerEntity> => {
    const player: Partial<PlayerEntity> = {
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Jugador Portfolio',
      league: 'La Liga',
      team: 'Portfolio FC',
      position: 'FW',
      rating: 8,
    };
    await ctx.dataSource.getRepository(PlayerEntity).save(player);
    return player as PlayerEntity;
  };

  const creditHolding = async (userId: string, playerId: string, quantity: number) => {
    await ctx.dataSource.getRepository(TokenHoldingEntity).save({
      id: randomUUID(),
      userId,
      playerId,
      quantity,
      updatedAt: new Date(),
    });
  };

  const insertCreditTx = async (userId: string, playerId: string, quantity: number, price: number) => {
    await ctx.dataSource.getRepository(TokenTransactionEntity).insert({
      id: randomUUID(),
      userId,
      type: 'CREDIT',
      playerId,
      quantity,
      price: price.toFixed(2),
      orderId: randomUUID(),
      counterpartOrderId: randomUUID(),
      createdAt: new Date(),
    });
  };

  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });

  it('sin JWT → 401', async () => {
    const { userId } = await registerAndLogin(`portfolio-401-${randomUUID()}@mail.com`);
    const res = await request(server()).get(`/users/${userId}/portfolio`);
    expect(res.status).toBe(401);
  });

  it('portfolio de otro usuario → 403', async () => {
    const { userId: userA } = await registerAndLogin(`portfolio-a-${randomUUID()}@mail.com`);
    const { token: tokenB } = await registerAndLogin(`portfolio-b-${randomUUID()}@mail.com`);
    const res = await request(server())
      .get(`/users/${userA}/portfolio`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it('sin holdings → portfolio vacío con summary en 0', async () => {
    const { token, userId } = await registerAndLogin(`portfolio-empty-${randomUUID()}@mail.com`);
    const res = await request(server())
      .get(`/users/${userId}/portfolio`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.holdings).toHaveLength(0);
    expect(res.body.summary.totalInvested).toBe(0);
    expect(res.body.summary.totalCurrentValue).toBe(0);
    expect(res.body.summary.netProfitLoss).toBe(0);
  });

  it('con holdings y transacciones → devuelve holdings con avg buy price calculado', async () => {
    const { token, userId } = await registerAndLogin(`portfolio-full-${randomUUID()}@mail.com`);
    const player = await insertPlayer();

    await creditHolding(userId, player.id, 10);
    await insertCreditTx(userId, player.id, 10, 15.0);

    const res = await request(server())
      .get(`/users/${userId}/portfolio`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.holdings).toHaveLength(1);

    const holding = res.body.holdings[0] as {
      playerId: string;
      playerName: string;
      tokenQuantity: number;
      averageBuyPrice: number;
    };
    expect(holding.playerId).toBe(player.id);
    expect(holding.playerName).toBe(player.name);
    expect(holding.tokenQuantity).toBe(10);
    expect(holding.averageBuyPrice).toBe(15);
  });

  it('holdings con quantity=0 no aparecen en el resultado', async () => {
    const { token, userId } = await registerAndLogin(`portfolio-zero-${randomUUID()}@mail.com`);
    const player = await insertPlayer();
    await creditHolding(userId, player.id, 0);

    const res = await request(server())
      .get(`/users/${userId}/portfolio`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.holdings).toHaveLength(0);
  });
});

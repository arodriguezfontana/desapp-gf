import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { TokenHoldingEntity } from '../src/repositories/portfolio/entities/token-holding.entity';
import { createTestApp, TestContext } from './test-app';

/**
 * 020-order-matching-engine, Historia 3 (spec FR-008 a FR-010, SC-003).
 * Sin matching: el libro siempre arranca vacío para cada test.
 */
describe('POST /orders — creación con precio automático (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async (email: string, username: string) => {
    await request(server())
      .post('/auth/register')
      .send({ email, password: 'Abcd1234!', username });
    const login = await request(server())
      .post('/auth/login')
      .send({ email, password: 'Abcd1234!' });
    return login.body.accessToken as string;
  };

  const insertPlayer = async (overrides: Partial<PlayerEntity> = {}) => {
    const player: Partial<PlayerEntity> = {
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Jugador Test',
      league: 'Premier League',
      team: 'Test FC',
      position: 'FW',
      rating: 7,
      ...overrides,
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

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.dataSource.query('DELETE FROM "token_transactions"');
    await ctx.dataSource.query('DELETE FROM "orders"');
    await ctx.dataSource.query('DELETE FROM "token_holdings"');
    await ctx.dataSource.query('DELETE FROM "player_quotes"');
    await ctx.dataSource.query('DELETE FROM "valuation_strategies"');
    await ctx.dataSource.query('DELETE FROM "users"');
    await ctx.dataSource.query('DELETE FROM "players"');
  });

  it('sin candidatas en el libro: queda PENDING con el precio de GET /players/:id/valuation', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('comprador1@mail.com', 'comprador1');

    const valuation = await request(server())
      .get(`/players/${player.id}/valuation`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.remainingQuantity).toBe(10);
    expect(res.body.fills).toEqual([]);
    // El precio de la orden se redondea a 2 decimales (spec FR-011a); la
    // valuation cruda puede tener más precisión, así que se compara contra
    // el mismo redondeo, no contra el valor crudo.
    const expectedPrice = Math.round(Number(valuation.body.value) * 100) / 100;
    expect(Number(res.body.price)).toBe(expectedPrice);
  });

  it('404 si el jugador no existe, sin crear ninguna orden', async () => {
    const token = await registerAndLogin('comprador2@mail.com', 'comprador2');

    const res = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ side: 'BUY', playerId: randomUUID(), quantity: 5 });

    expect(res.status).toBe(404);

    const orders = await ctx.dataSource.query('SELECT * FROM "orders"');
    expect(orders).toHaveLength(0);
  });

  it('400 si SELL con holding insuficiente, sin crear ninguna orden ni afectar el holding', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('vendedor1@mail.com', 'vendedor1');
    const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    await creditHolding(me.body.id, player.id, 3);

    const res = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 10 });

    expect(res.status).toBe(400);

    const orders = await ctx.dataSource.query('SELECT * FROM "orders"');
    expect(orders).toHaveLength(0);

    const holding = await ctx.dataSource
      .getRepository(TokenHoldingEntity)
      .findOne({ where: { userId: me.body.id, playerId: player.id } });
    expect(holding!.quantity).toBe(3);
  });

  it('401 sin JWT', async () => {
    const res = await request(server()).post('/orders').send({ side: 'BUY', playerId: randomUUID(), quantity: 1 });
    expect(res.status).toBe(401);
  });

  it('400 si se intenta enviar un campo price (DTO estricto, no se acepta)', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('comprador3@mail.com', 'comprador3');

    const res = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 1, price: 999 });

    expect(res.status).toBe(400);
  });

  it('400 si SELL con holding suficiente pero ya hay órdenes SELL abiertas que lo agotan (overselling)', async () => {
    const player = await insertPlayer();
    const token = await registerAndLogin('oversell@mail.com', 'oversell');
    const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    await creditHolding(me.body.id, player.id, 10);

    // Primera SELL de 7: OK (holding 10 >= 7)
    const res1 = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 7 });
    expect(res1.status).toBe(201);

    // Segunda SELL de 5: debe fallar (holding 10 < 7 pendiente + 5 nueva = 12)
    const res2 = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 5 });
    expect(res2.status).toBe(400);

    // Segunda SELL de 3: debe pasar (holding 10 >= 7 pendiente + 3 nueva = 10)
    const res3 = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 3 });
    expect(res3.status).toBe(201);
  });

  it('dos usuarios con estrategias distintas obtienen precios propios para el mismo jugador/cantidad', async () => {
    const player = await insertPlayer({
      goals: 10,
      assists: 5,
      shots: 20,
      keyPasses: 8,
      dribbles: 6,
      totalTackles: 2,
      rating: 7.8,
    });

    const token1 = await registerAndLogin('estrategia1@mail.com', 'estrategia1');
    const token2 = await registerAndLogin('estrategia2@mail.com', 'estrategia2');

    // El usuario 2 cambia su estrategia seleccionada a la otra default
    // ("Impacto táctico") para garantizar pesos distintos a los del usuario 1
    // (que se queda con la default "Performance general").
    const strategies = await request(server())
      .get('/users/me/strategies')
      .set('Authorization', `Bearer ${token2}`);
    const tactical = strategies.body.strategies.find(
      (s: { name: string }) => s.name === 'Impacto táctico',
    );
    await request(server())
      .patch(`/users/me/strategies/${tactical.id}/select`)
      .set('Authorization', `Bearer ${token2}`);

    const res1 = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${token1}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });
    const res2 = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${token2}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.price).not.toBe(res2.body.price);
  });
});

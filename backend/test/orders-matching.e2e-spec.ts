import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { TokenHoldingEntity } from '../src/repositories/portfolio/entities/token-holding.entity';
import { TokenTransactionEntity } from '../src/repositories/orders/entities/token-transaction.entity';
import { SuperuserSeedService } from '../src/services/auth/superuser-seed.service';
import { createTestApp, TestContext } from './test-app';

/**
 * 020-order-matching-engine, Historia 4 (matching exacto FIFO, FR-011 a
 * FR-015) e Historia 5 (holdings y TokenTransaction, FR-016/FR-017).
 *
 * Todos los usuarios de este archivo se registran sin tocar su estrategia
 * seleccionada: las dos estrategias default (seed de 019) son idénticas
 * para cualquier alta nueva, así que dos usuarios distintos valuando el
 * mismo jugador obtienen siempre el mismo precio — condición necesaria
 * para que el match exacto dispare.
 */
describe('POST /orders — motor de matching (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async (email: string, username: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!', username });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    return { token: login.body.accessToken as string, userId: me.body.id as string };
  };

  const insertPlayer = async (overrides: Partial<PlayerEntity> = {}) => {
    const player: Partial<PlayerEntity> = {
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Jugador Matching',
      league: 'Premier League',
      team: 'Matching FC',
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

  const holdingOf = async (userId: string, playerId: string) =>
    ctx.dataSource.getRepository(TokenHoldingEntity).findOne({ where: { userId, playerId } });

  const transactionsFor = async (orderId: string) =>
    ctx.dataSource.getRepository(TokenTransactionEntity).find({ where: { orderId } });

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

  it('match completo contra una única orden existente: ambas quedan COMPLETED (spec Historia 4, escenario 1)', async () => {
    const player = await insertPlayer();
    const seller = await registerAndLogin('seller1@mail.com', 'seller1');
    const buyer = await registerAndLogin('buyer1@mail.com', 'buyer1');
    await creditHolding(seller.userId, player.id, 10);

    const sellRes = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 10 });
    expect(sellRes.status).toBe(201);
    expect(sellRes.body.status).toBe('PENDING');

    const buyRes = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });

    expect(buyRes.status).toBe(201);
    expect(buyRes.body.status).toBe('COMPLETED');
    expect(buyRes.body.remainingQuantity).toBe(0);
    expect(buyRes.body.fills).toHaveLength(1);
    expect(buyRes.body.fills[0]).toMatchObject({ counterpartOrderId: sellRes.body.id, quantity: 10 });

    const sellRow = await ctx.dataSource.query('SELECT * FROM "orders" WHERE id = $1', [sellRes.body.id]);
    expect(sellRow[0].status).toBe('COMPLETED');
    expect(sellRow[0].remaining_quantity).toBe(0);
  });

  it('match parcial combinando varias candidatas FIFO, con remanente (spec Historia 4, escenario 2/3)', async () => {
    const player = await insertPlayer();
    const seller1 = await registerAndLogin('fifo-seller1@mail.com', 'fifo-seller1');
    const seller2 = await registerAndLogin('fifo-seller2@mail.com', 'fifo-seller2');
    const buyer = await registerAndLogin('fifo-buyer@mail.com', 'fifo-buyer');
    await creditHolding(seller1.userId, player.id, 7);
    await creditHolding(seller2.userId, player.id, 20);

    const sell1 = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${seller1.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 7 });
    const sell2 = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${seller2.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 20 });
    expect(sell1.body.price).toBe(sell2.body.price); // misma estrategia default → mismo precio exacto

    const buyRes = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });

    expect(buyRes.status).toBe(201);
    expect(buyRes.body.status).toBe('COMPLETED');
    expect(buyRes.body.fills).toHaveLength(2);
    // FIFO: la más antigua (seller1, 7) se cubre por completo primero; el resto (3) contra seller2.
    expect(buyRes.body.fills[0]).toMatchObject({ counterpartOrderId: sell1.body.id, quantity: 7 });
    expect(buyRes.body.fills[1]).toMatchObject({ counterpartOrderId: sell2.body.id, quantity: 3 });

    const sell1Row = (await ctx.dataSource.query('SELECT * FROM "orders" WHERE id = $1', [sell1.body.id]))[0];
    const sell2Row = (await ctx.dataSource.query('SELECT * FROM "orders" WHERE id = $1', [sell2.body.id]))[0];
    expect(sell1Row.status).toBe('COMPLETED');
    expect(sell2Row.status).toBe('PARTIALLY_FILLED');
    expect(sell2Row.remaining_quantity).toBe(17);
  });

  it('sin ninguna candidata compatible: toda la cantidad queda PENDING, sin ejecutar nada (spec Historia 4, escenario 4)', async () => {
    const player = await insertPlayer();
    const buyer = await registerAndLogin('alone-buyer@mail.com', 'alone-buyer');

    const res = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 5 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.remainingQuantity).toBe(5);
    expect(res.body.fills).toEqual([]);
  });

  it('el superusuario matchea con un usuario cualquiera sin tratamiento especial (spec DD-004, Historia 4 escenario 6)', async () => {
    process.env.SUPERUSER_EMAIL = 'superuser-matching@mail.com';
    process.env.SUPERUSER_PASSWORD = 'SuperPass1!';
    const player = await insertPlayer();

    await ctx.app.get(SuperuserSeedService).run();

    const buyer = await registerAndLogin('buys-from-superuser@mail.com', 'buys-from-superuser');

    const res = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.fills).toHaveLength(1);

    delete process.env.SUPERUSER_EMAIL;
    delete process.env.SUPERUSER_PASSWORD;
  });

  it('una ejecución completa actualiza ambos holdings exactamente en la cantidad ejecutada (spec Historia 5, escenario 1)', async () => {
    const player = await insertPlayer();
    const seller = await registerAndLogin('holding-seller@mail.com', 'holding-seller');
    const buyer = await registerAndLogin('holding-buyer@mail.com', 'holding-buyer');
    await creditHolding(seller.userId, player.id, 10);

    await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 10 });
    await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });

    const buyerHolding = await holdingOf(buyer.userId, player.id);
    const sellerHolding = await holdingOf(seller.userId, player.id);
    expect(buyerHolding!.quantity).toBe(10);
    expect(sellerHolding!.quantity).toBe(0);
  });

  it('una ejecución completa genera exactamente un CREDIT y un DEBIT, referenciando orderId/counterpartOrderId correctamente (spec Historia 5, escenario 2)', async () => {
    const player = await insertPlayer();
    const seller = await registerAndLogin('tx-seller@mail.com', 'tx-seller');
    const buyer = await registerAndLogin('tx-buyer@mail.com', 'tx-buyer');
    await creditHolding(seller.userId, player.id, 10);

    const sellRes = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 10 });
    const buyRes = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });

    const buyerTx = await transactionsFor(buyRes.body.id);
    const sellerTx = await transactionsFor(sellRes.body.id);

    expect(buyerTx).toHaveLength(1);
    expect(buyerTx[0].type).toBe('CREDIT');
    expect(buyerTx[0].userId).toBe(buyer.userId);
    expect(buyerTx[0].counterpartOrderId).toBe(sellRes.body.id);
    expect(buyerTx[0].quantity).toBe(10);

    expect(sellerTx).toHaveLength(1);
    expect(sellerTx[0].type).toBe('DEBIT');
    expect(sellerTx[0].userId).toBe(seller.userId);
    expect(sellerTx[0].counterpartOrderId).toBe(buyRes.body.id);
    expect(sellerTx[0].quantity).toBe(10);
  });

  it('una orden fileada en varias ejecuciones parciales genera un par CREDIT/DEBIT por cada una (spec Historia 5, escenario 3)', async () => {
    const player = await insertPlayer();
    const seller1 = await registerAndLogin('multi-seller1@mail.com', 'multi-seller1');
    const seller2 = await registerAndLogin('multi-seller2@mail.com', 'multi-seller2');
    const buyer = await registerAndLogin('multi-buyer@mail.com', 'multi-buyer');
    await creditHolding(seller1.userId, player.id, 7);
    await creditHolding(seller2.userId, player.id, 20);

    const sell1 = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${seller1.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 7 });
    const sell2 = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${seller2.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 20 });

    const buyRes = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });

    const buyerTx = await transactionsFor(buyRes.body.id);
    expect(buyerTx).toHaveLength(2);
    expect(buyerTx.map((t) => t.quantity).sort()).toEqual([3, 7]);
    expect(buyerTx.every((t) => t.type === 'CREDIT')).toBe(true);

    const seller1Tx = await transactionsFor(sell1.body.id);
    const seller2Tx = await transactionsFor(sell2.body.id);
    expect(seller1Tx).toHaveLength(1);
    expect(seller1Tx[0]).toMatchObject({ type: 'DEBIT', quantity: 7, counterpartOrderId: buyRes.body.id });
    expect(seller2Tx).toHaveLength(1);
    expect(seller2Tx[0]).toMatchObject({ type: 'DEBIT', quantity: 3, counterpartOrderId: buyRes.body.id });
  });

  it('auto-match bloqueado: una orden no puede matchear contra una orden propia del mismo usuario', async () => {
    const player = await insertPlayer();
    const user = await registerAndLogin('self-match@mail.com', 'self-match');
    await creditHolding(user.userId, player.id, 10);

    const sellRes = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 10 });
    const buyRes = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ side: 'BUY', playerId: player.id, quantity: 10 });

    expect(buyRes.status).toBe(201);
    // La BUY no matchea contra la propia SELL: queda PENDING
    expect(buyRes.body.status).toBe('PENDING');

    // El holding no cambia: ninguna transacción fue ejecutada
    const holding = await holdingOf(user.userId, player.id);
    expect(holding!.quantity).toBe(10);

    const sellRow = (await ctx.dataSource.query('SELECT * FROM "orders" WHERE id = $1', [sellRes.body.id]))[0];
    expect(sellRow.status).toBe('PENDING');
  });
});

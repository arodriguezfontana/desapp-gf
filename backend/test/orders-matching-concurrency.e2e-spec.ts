import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { TokenHoldingEntity } from '../src/repositories/portfolio/entities/token-holding.entity';
import { TokenTransactionEntity } from '../src/repositories/orders/entities/token-transaction.entity';
import { OrderEntity } from '../src/repositories/orders/entities/order.entity';
import { createTestApp, TestContext } from './test-app';

/**
 * 020-order-matching-engine, spec FR-021/SC-008: la cantidad pendiente de
 * una orden se consume de forma atómica/serializada bajo concurrencia — la
 * suma de los fills ejecutados contra ella nunca excede su cantidad
 * disponible, sin importar cuántas solicitudes concurrentes compitan por
 * ella (research.md D4: locking pesimista con orden determinístico).
 */
jest.setTimeout(60_000);

describe('POST /orders — concurrencia del matching (e2e, FR-021/SC-008)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  const registerAndLogin = async (email: string, username: string) => {
    await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!', username });
    const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
    const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    return { token: login.body.accessToken as string, userId: me.body.id as string };
  };

  const insertPlayer = async () => {
    const player: Partial<PlayerEntity> = {
      id: randomUUID(),
      externalId: `ext-${randomUUID()}`,
      name: 'Jugador Concurrencia',
      league: 'Premier League',
      team: 'Concurrencia FC',
      position: 'FW',
      rating: 7,
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

  it('5 BUY concurrentes (3 cada uno, 15 pedidos) contra una única SELL de 10 nunca la sobre-fillean', async () => {
    const player = await insertPlayer();
    const seller = await registerAndLogin('conc-seller@mail.com', 'conc-seller');
    await creditHolding(seller.userId, player.id, 10);

    const sellRes = await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 10 });
    expect(sellRes.status).toBe(201);
    const sellOrderId = sellRes.body.id as string;

    const buyers = await Promise.all(
      Array.from({ length: 5 }, (_, i) => registerAndLogin(`conc-buyer${i}@mail.com`, `conc-buyer${i}`)),
    );

    const responses = await Promise.all(
      buyers.map((buyer) =>
        request(server())
          .post('/orders')
          .set('Authorization', `Bearer ${buyer.token}`)
          .send({ side: 'BUY', playerId: player.id, quantity: 3 }),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(201);
    }

    // Invariante 1: la orden SELL nunca queda con remaining_quantity negativo,
    // y la suma de lo fileado contra ella (10 - remaining) nunca supera su
    // cantidad original (10).
    const sellRow = (
      await ctx.dataSource.getRepository(OrderEntity).find({ where: { id: sellOrderId } })
    )[0];
    expect(sellRow.remainingQuantity).toBeGreaterThanOrEqual(0);
    expect(sellRow.remainingQuantity).toBeLessThanOrEqual(10);
    const totalFilledAgainstSell = 10 - sellRow.remainingQuantity;

    // Invariante 2: la suma de TODOS los fills devueltos por las 5 respuestas
    // (desde la perspectiva de cada BUY) coincide exactamente con lo que la
    // SELL registra como fileado — ninguna cantidad se "pierde" ni se duplica.
    const totalFilledFromBuyers = responses.reduce(
      (sum, res) => sum + res.body.fills.reduce((s: number, f: { quantity: number }) => s + f.quantity, 0),
      0,
    );
    expect(totalFilledFromBuyers).toBe(totalFilledAgainstSell);

    // Con 15 pedidos contra 10 disponibles, la demanda alcanza para agotar
    // la SELL por completo.
    expect(totalFilledAgainstSell).toBe(10);
    expect(sellRow.status).toBe('COMPLETED');

    // Invariante 3: el holding del vendedor nunca queda negativo, y termina
    // exactamente en (10 - lo fileado).
    const sellerHolding = await ctx.dataSource
      .getRepository(TokenHoldingEntity)
      .findOne({ where: { userId: seller.userId, playerId: player.id } });
    expect(sellerHolding!.quantity).toBe(10 - totalFilledAgainstSell);
    expect(sellerHolding!.quantity).toBeGreaterThanOrEqual(0);

    // Invariante 4: la suma de los DEBIT registrados contra la orden SELL
    // coincide exactamente con lo fileado — ninguna ejecución concurrente
    // duplicó ni perdió un TokenTransaction.
    const debitSum = (
      await ctx.dataSource.getRepository(TokenTransactionEntity).find({
        where: { orderId: sellOrderId, type: 'DEBIT' as never },
      })
    ).reduce((sum, tx) => sum + tx.quantity, 0);
    expect(debitSum).toBe(totalFilledAgainstSell);

    // Invariante 5: la suma de holdings de los 5 compradores coincide
    // exactamente con lo fileado (ningún crédito se perdió ni se duplicó).
    let totalBuyerHoldings = 0;
    for (const buyer of buyers) {
      const holding = await ctx.dataSource
        .getRepository(TokenHoldingEntity)
        .findOne({ where: { userId: buyer.userId, playerId: player.id } });
      totalBuyerHoldings += holding?.quantity ?? 0;
    }
    expect(totalBuyerHoldings).toBe(totalFilledAgainstSell);
  });

  it('2 solicitudes simultáneas que matchean exactamente la misma orden (mismo jugador, lados opuestos, mismo precio) no la duplican ni la pierden', async () => {
    const player = await insertPlayer();
    const sellerA = await registerAndLogin('race-sellerA@mail.com', 'race-sellerA');
    const sellerB = await registerAndLogin('race-sellerB@mail.com', 'race-sellerB');
    const buyer = await registerAndLogin('race-buyer@mail.com', 'race-buyer');
    await creditHolding(sellerA.userId, player.id, 5);
    await creditHolding(sellerB.userId, player.id, 5);

    // Dos SELL existentes al mismo precio (misma estrategia default), 5 cada una.
    await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 5 });
    await request(server())
      .post('/orders')
      .set('Authorization', `Bearer ${sellerB.token}`)
      .send({ side: 'SELL', playerId: player.id, quantity: 5 });

    // Dos BUY concurrentes del mismo comprador... en paralelo, por 6 cada una
    // (12 pedidos contra 10 disponibles): ninguna combinación de ejecuciones
    // concurrentes puede dejar una SELL con remaining_quantity negativo.
    const [res1, res2] = await Promise.all([
      request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ side: 'BUY', playerId: player.id, quantity: 6 }),
      request(server())
        .post('/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ side: 'BUY', playerId: player.id, quantity: 6 }),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const sellRows = await ctx.dataSource.query(
      'SELECT remaining_quantity FROM "orders" WHERE user_id IN ($1, $2)',
      [sellerA.userId, sellerB.userId],
    );
    for (const row of sellRows) {
      expect(row.remaining_quantity).toBeGreaterThanOrEqual(0);
    }

    const buyerHolding = await ctx.dataSource
      .getRepository(TokenHoldingEntity)
      .findOne({ where: { userId: buyer.userId, playerId: player.id } });
    const totalFilled =
      res1.body.fills.reduce((s: number, f: { quantity: number }) => s + f.quantity, 0) +
      res2.body.fills.reduce((s: number, f: { quantity: number }) => s + f.quantity, 0);

    // 10 disponibles, 12 pedidos: la demanda agota toda la oferta.
    expect(totalFilled).toBe(10);
    expect(buyerHolding!.quantity).toBe(10);
  });
});

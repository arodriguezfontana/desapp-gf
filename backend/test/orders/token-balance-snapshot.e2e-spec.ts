import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { IsNull } from 'typeorm';
import { PlayerEntity } from '../../src/repositories/player/entities/player.entity';
import { TokenHoldingEntity } from '../../src/repositories/portfolio/entities/token-holding.entity';
import { TokenTransactionEntity } from '../../src/repositories/orders/entities/token-transaction.entity';
import { TokenTransactionRepository } from '../../src/repositories/orders/token-transaction.repository';
import { SuperuserSeedService } from '../../src/services/auth/superuser-seed.service';
import { createTestApp, TestContext } from '../test-app';

/**
 * 030-token-balance-snapshot. Cada asiento de auditoría guarda el saldo de la tenencia antes y
 * después del movimiento, capturado en la misma transacción que la operación. La base es la
 * efímera de Testcontainers.
 *
 * Nota: un auto-cruce (el mismo usuario como comprador y vendedor) no es alcanzable por la API,
 * porque la búsqueda de contrapartes excluye las órdenes propias; se cubre en el dominio
 * (`settle-fills-audited.spec.ts`).
 */
let ctx: TestContext;
const server = () => ctx.app.getHttpServer();

const registerAndLogin = async (email: string, username: string) => {
  await request(server()).post('/auth/register').send({ email, password: 'Abcd1234!', username });
  const login = await request(server()).post('/auth/login').send({ email, password: 'Abcd1234!' });
  const me = await request(server()).get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
  return { token: login.body.accessToken as string, userId: me.body.id as string };
};

const insertPlayer = async (): Promise<PlayerEntity> => {
  const player: Partial<PlayerEntity> = {
    id: randomUUID(),
    externalId: `ext-${randomUUID()}`,
    name: 'Jugador Snapshot',
    league: 'Premier League',
    team: 'Snapshot FC',
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

const holdingQuantity = async (userId: string, playerId: string): Promise<number | undefined> =>
  (await ctx.dataSource.getRepository(TokenHoldingEntity).findOne({ where: { userId, playerId } }))?.quantity;

/**
 * Asientos de un usuario sobre un jugador, en el orden de la cadena: por instante y, a igual
 * instante (varios fills de una misma orden), por saldo anterior ascendente en los CREDIT y
 * descendente en los DEBIT (en ambos casos es el orden en que se aplicaron).
 */
const entriesOf = async (userId: string, playerId: string): Promise<TokenTransactionEntity[]> => {
  const rows = await ctx.dataSource.getRepository(TokenTransactionEntity).find({ where: { userId, playerId } });
  return rows.sort((a, b) => {
    const byTime = a.createdAt.getTime() - b.createdAt.getTime();
    if (byTime !== 0) return byTime;
    const direction = a.type === 'CREDIT' ? 1 : -1;
    return direction * ((a.balanceBefore ?? 0) - (b.balanceBefore ?? 0));
  });
};

const placeOrder = (token: string, side: 'BUY' | 'SELL', playerId: string, quantity: number) =>
  request(server()).post('/orders').set('Authorization', `Bearer ${token}`).send({ side, playerId, quantity });

const cleanDatabase = async () => {
  await ctx.dataSource.query('DELETE FROM "token_transactions"');
  await ctx.dataSource.query('DELETE FROM "orders"');
  await ctx.dataSource.query('DELETE FROM "token_holdings"');
  await ctx.dataSource.query('DELETE FROM "player_quotes"');
  await ctx.dataSource.query('DELETE FROM "valuation_strategies"');
  await ctx.dataSource.query('DELETE FROM "users"');
  await ctx.dataSource.query('DELETE FROM "players"');
};

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await cleanDatabase();
});

describe('US1: cada movimiento de una orden queda con su saldo anterior y posterior (e2e, spec 030)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('compra y venta: el CREDIT del comprador (10→15) y el DEBIT del vendedor (10→5) traen sus saldos', async () => {
    const player = await insertPlayer();
    const seller = await registerAndLogin('snap-seller@mail.com', 'snap-seller');
    const buyer = await registerAndLogin('snap-buyer@mail.com', 'snap-buyer');
    await creditHolding(seller.userId, player.id, 10);
    await creditHolding(buyer.userId, player.id, 10);

    await placeOrder(seller.token, 'SELL', player.id, 5);
    const buyRes = await placeOrder(buyer.token, 'BUY', player.id, 5);
    expect(buyRes.status).toBe(201);

    const [credit] = await entriesOf(buyer.userId, player.id);
    const [debit] = await entriesOf(seller.userId, player.id);
    expect(credit).toMatchObject({ type: 'CREDIT', quantity: 5, balanceBefore: 10, balanceAfter: 15 });
    expect(debit).toMatchObject({ type: 'DEBIT', quantity: 5, balanceBefore: 10, balanceAfter: 5 });
    expect(await holdingQuantity(buyer.userId, player.id)).toBe(15);
    expect(await holdingQuantity(seller.userId, player.id)).toBe(5);
  });

  it('un comprador sin tenencia previa parte de saldo 0', async () => {
    const player = await insertPlayer();
    const seller = await registerAndLogin('snap-seller2@mail.com', 'snap-seller2');
    const buyer = await registerAndLogin('snap-buyer2@mail.com', 'snap-buyer2');
    await creditHolding(seller.userId, player.id, 10);

    await placeOrder(seller.token, 'SELL', player.id, 10);
    await placeOrder(buyer.token, 'BUY', player.id, 3);

    const [credit] = await entriesOf(buyer.userId, player.id);
    expect(credit).toMatchObject({ balanceBefore: 0, balanceAfter: 3 });
  });

  it('un débito que deja la tenencia en 0 queda con saldo posterior 0', async () => {
    const player = await insertPlayer();
    const seller = await registerAndLogin('snap-seller3@mail.com', 'snap-seller3');
    const buyer = await registerAndLogin('snap-buyer3@mail.com', 'snap-buyer3');
    await creditHolding(seller.userId, player.id, 4);

    await placeOrder(seller.token, 'SELL', player.id, 4);
    await placeOrder(buyer.token, 'BUY', player.id, 4);

    const [debit] = await entriesOf(seller.userId, player.id);
    expect(debit).toMatchObject({ balanceBefore: 4, balanceAfter: 0 });
  });

  it('una orden con varias contrapartes deja una cadena continua y el último saldo es la tenencia', async () => {
    const player = await insertPlayer();
    const seller1 = await registerAndLogin('chain-seller1@mail.com', 'chain-seller1');
    const seller2 = await registerAndLogin('chain-seller2@mail.com', 'chain-seller2');
    const buyer = await registerAndLogin('chain-buyer@mail.com', 'chain-buyer');
    await creditHolding(seller1.userId, player.id, 7);
    await creditHolding(seller2.userId, player.id, 20);

    await placeOrder(seller1.token, 'SELL', player.id, 7);
    await placeOrder(seller2.token, 'SELL', player.id, 20);
    const buyRes = await placeOrder(buyer.token, 'BUY', player.id, 10);
    expect(buyRes.body.fills).toHaveLength(2);

    const chain = await entriesOf(buyer.userId, player.id);
    expect(chain).toHaveLength(2);
    expect(chain[0]).toMatchObject({ balanceBefore: 0, balanceAfter: 7 });
    expect(chain[1]).toMatchObject({ balanceBefore: 7, balanceAfter: 10 });
    expect(chain[1].balanceAfter).toBe(await holdingQuantity(buyer.userId, player.id));

    const [debit1] = await entriesOf(seller1.userId, player.id);
    const [debit2] = await entriesOf(seller2.userId, player.id);
    expect(debit1).toMatchObject({ balanceBefore: 7, balanceAfter: 0 });
    expect(debit2).toMatchObject({ balanceBefore: 20, balanceAfter: 17 });
  });

  it('para todo asiento: posterior = anterior ± cantidad, sin saldos negativos, y último saldo = tenencia', async () => {
    const player = await insertPlayer();
    const seller = await registerAndLogin('inv-seller@mail.com', 'inv-seller');
    const buyer = await registerAndLogin('inv-buyer@mail.com', 'inv-buyer');
    await creditHolding(seller.userId, player.id, 30);

    await placeOrder(seller.token, 'SELL', player.id, 12);
    await placeOrder(buyer.token, 'BUY', player.id, 5);
    await placeOrder(buyer.token, 'BUY', player.id, 4);

    const all = await ctx.dataSource.getRepository(TokenTransactionEntity).find();
    expect(all).toHaveLength(4);
    for (const entry of all) {
      const delta = entry.type === 'CREDIT' ? entry.quantity : -entry.quantity;
      expect(entry.balanceBefore).not.toBeNull();
      expect(entry.balanceAfter).toBe((entry.balanceBefore as number) + delta);
      expect(entry.balanceBefore).toBeGreaterThanOrEqual(0);
      expect(entry.balanceAfter).toBeGreaterThanOrEqual(0);
    }
    const buyerChain = await entriesOf(buyer.userId, player.id);
    expect(buyerChain[1].balanceBefore).toBe(buyerChain[0].balanceAfter);
    expect(buyerChain[1].balanceAfter).toBe(await holdingQuantity(buyer.userId, player.id));
    const sellerChain = await entriesOf(seller.userId, player.id);
    expect(sellerChain[sellerChain.length - 1].balanceAfter).toBe(await holdingQuantity(seller.userId, player.id));
  });

  it('atomicidad: si la operación falla a mitad de camino no queda ningún asiento ni cambia ninguna tenencia', async () => {
    const player = await insertPlayer();
    const seller1 = await registerAndLogin('atom-seller1@mail.com', 'atom-seller1');
    const seller2 = await registerAndLogin('atom-seller2@mail.com', 'atom-seller2');
    const buyer = await registerAndLogin('atom-buyer@mail.com', 'atom-buyer');
    await creditHolding(seller1.userId, player.id, 7);
    await creditHolding(seller2.userId, player.id, 20);
    await placeOrder(seller1.token, 'SELL', player.id, 7);
    await placeOrder(seller2.token, 'SELL', player.id, 20);
    const entriesBefore = await ctx.dataSource.getRepository(TokenTransactionEntity).count();
    const ordersBefore = await ctx.dataSource.query('SELECT id, status, remaining_quantity FROM "orders" ORDER BY id');

    // La primera inserción de asiento se hace, la segunda falla: debe deshacerse todo, incluida la primera.
    const original = TokenTransactionRepository.prototype.saveInTransaction;
    let calls = 0;
    jest
      .spyOn(TokenTransactionRepository.prototype, 'saveInTransaction')
      .mockImplementation(function (this: TokenTransactionRepository, tx, entry) {
        calls += 1;
        if (calls === 2) return Promise.reject(new Error('fallo forzado de prueba'));
        return original.call(this, tx, entry);
      });

    const res = await placeOrder(buyer.token, 'BUY', player.id, 10);

    expect(res.status).toBe(500);
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(await ctx.dataSource.getRepository(TokenTransactionEntity).count()).toBe(entriesBefore);
    expect(await holdingQuantity(seller1.userId, player.id)).toBe(7);
    expect(await holdingQuantity(seller2.userId, player.id)).toBe(20);
    expect(await holdingQuantity(buyer.userId, player.id)).toBeUndefined();
    expect(await ctx.dataSource.query('SELECT id, status, remaining_quantity FROM "orders" ORDER BY id')).toEqual(
      ordersBefore,
    );
  });
});

describe('US2: la emisión inicial también queda auditada (e2e, spec 030)', () => {
  const SUPERUSER_EMAIL = 'superuser-snapshot@mail.com';
  const SUPERUSER_PASSWORD = 'SuperPass1!';

  const runSeed = () => ctx.app.get(SuperuserSeedService).run();

  const superuserId = async (): Promise<string> => {
    const rows = await ctx.dataSource.query(`SELECT id FROM "users" WHERE username = 'superuser'`);
    return rows[0].id as string;
  };

  const emissionEntries = (userId: string) =>
    ctx.dataSource.getRepository(TokenTransactionEntity).find({ where: { userId, orderId: IsNull() } });

  beforeEach(() => {
    process.env.SUPERUSER_EMAIL = SUPERUSER_EMAIL;
    process.env.SUPERUSER_PASSWORD = SUPERUSER_PASSWORD;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.SUPERUSER_EMAIL;
    delete process.env.SUPERUSER_PASSWORD;
  });

  it('provisionar la liquidez deja un asiento CREDIT 0→100 por jugador, sin orden ni contraparte', async () => {
    const player1 = await insertPlayer();
    const player2 = await insertPlayer();

    await runSeed();

    const userId = await superuserId();
    const entries = await emissionEntries(userId);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.playerId).sort()).toEqual([player1.id, player2.id].sort());
    for (const entry of entries) {
      expect(entry).toMatchObject({
        type: 'CREDIT',
        quantity: 100,
        balanceBefore: 0,
        balanceAfter: 100,
        orderId: null,
        counterpartOrderId: null,
      });
      expect(await holdingQuantity(userId, entry.playerId)).toBe(100);
    }
  });

  it('volver a provisionar (reinicio) no emite ni audita nada otra vez', async () => {
    await insertPlayer();
    await runSeed();
    const userId = await superuserId();
    const before = await ctx.dataSource.getRepository(TokenTransactionEntity).count({ where: { userId } });

    await runSeed();

    expect(await ctx.dataSource.getRepository(TokenTransactionEntity).count({ where: { userId } })).toBe(before);
    expect(before).toBe(1);
  });

  it('la primera venta del superusuario parte del saldo 100 de la emisión (100→90) y la cadena empalma sin huecos', async () => {
    const player = await insertPlayer();
    await runSeed();
    const userId = await superuserId();
    const buyer = await registerAndLogin('buys-from-su@mail.com', 'buys-from-su');

    const res = await placeOrder(buyer.token, 'BUY', player.id, 10);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');

    const chain = await entriesOf(userId, player.id);
    const emission = chain.find((e) => e.orderId === null)!;
    const sale = chain.find((e) => e.orderId !== null)!;
    expect(emission).toMatchObject({ balanceBefore: 0, balanceAfter: 100 });
    expect(sale).toMatchObject({ type: 'DEBIT', quantity: 10, balanceBefore: 100, balanceAfter: 90 });
    expect(sale.balanceBefore).toBe(emission.balanceAfter);
    expect(sale.balanceAfter).toBe(await holdingQuantity(userId, player.id));
  });

  it('atomicidad: si falla guardar el asiento, no queda ni tenencia, ni orden, ni asiento de esa emisión; y se recupera al reintentar', async () => {
    await insertPlayer();
    const original = TokenTransactionRepository.prototype.saveInTransaction;
    const failing = jest
      .spyOn(TokenTransactionRepository.prototype, 'saveInTransaction')
      .mockRejectedValue(new Error('fallo forzado de prueba'));

    await runSeed();

    const userId = await superuserId();
    expect(failing).toHaveBeenCalled();
    expect(await ctx.dataSource.query('SELECT 1 FROM "token_holdings" WHERE user_id = $1', [userId])).toHaveLength(0);
    expect(await ctx.dataSource.query('SELECT 1 FROM "orders" WHERE user_id = $1', [userId])).toHaveLength(0);
    expect(await ctx.dataSource.getRepository(TokenTransactionEntity).count({ where: { userId } })).toBe(0);

    failing.mockImplementation(function (this: TokenTransactionRepository, tx, entry) {
      return original.call(this, tx, entry);
    });
    await runSeed();

    expect(await emissionEntries(userId)).toHaveLength(1);
    expect(await ctx.dataSource.query('SELECT 1 FROM "orders" WHERE user_id = $1', [userId])).toHaveLength(1);
  });

  it('con el asiento de emisión presente, el historial y el costo promedio del portafolio no cambian', async () => {
    await insertPlayer();
    await runSeed();
    const userId = await superuserId();
    expect(await emissionEntries(userId)).toHaveLength(1);
    const login = await request(server()).post('/auth/login').send({ email: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD });
    const token = login.body.accessToken as string;

    const history = await request(server()).get('/orders/history').set('Authorization', `Bearer ${token}`);
    const portfolio = await request(server()).get(`/users/${userId}/portfolio`).set('Authorization', `Bearer ${token}`);

    expect(history.status).toBe(200);
    expect(history.body).toEqual([]);
    expect(portfolio.status).toBe(200);
    expect(portfolio.body.holdings).toHaveLength(1);
    expect(portfolio.body.holdings[0].tokenQuantity).toBe(100);
    // Sin compras reales, el costo promedio es 0: el CREDIT de emisión no se cuenta como una compra.
    expect(portfolio.body.holdings[0].averageBuyPrice).toBe(0);
  });
});

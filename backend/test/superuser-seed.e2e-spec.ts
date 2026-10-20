import * as request from 'supertest';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { UserEntity } from '../src/repositories/auth/entities/user.entity';
import { OrderEntity } from '../src/repositories/orders/entities/order.entity';
import { TokenHoldingEntity } from '../src/repositories/portfolio/entities/token-holding.entity';
import { SuperuserSeedService } from '../src/services/auth/superuser-seed.service';
import { createTestApp, TestContext } from './test-app';

const SUPERUSER_EMAIL = 'superuser-seed-test@mail.com';
const SUPERUSER_PASSWORD = 'SuperPass1!';

const PLAYER_FIXTURES: Partial<PlayerEntity>[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    externalId: 'ws-seed-1',
    name: 'Jugador Seed Uno',
    league: 'Premier League',
    team: 'Seed FC',
    position: 'FW',
    rating: 7.5,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    externalId: 'ws-seed-2',
    name: 'Jugador Seed Dos',
    league: 'La Liga',
    team: 'Seed CD',
    position: 'MF',
    rating: 6.8,
  },
];

/**
 * 020-order-matching-engine, Historia 2 (spec FR-004 a FR-007, SC-002/SC-003).
 */
describe('SuperuserSeedService.run (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    process.env.SUPERUSER_EMAIL = SUPERUSER_EMAIL;
    process.env.SUPERUSER_PASSWORD = SUPERUSER_PASSWORD;
    ctx = await createTestApp();

    await ctx.dataSource.query('DELETE FROM "token_transactions"');
    await ctx.dataSource.query('DELETE FROM "orders"');
    await ctx.dataSource.query('DELETE FROM "token_holdings"');
    await ctx.dataSource.query('DELETE FROM "players"');
    await ctx.dataSource.getRepository(PlayerEntity).save(PLAYER_FIXTURES);
  });

  afterAll(async () => {
    delete process.env.SUPERUSER_EMAIL;
    delete process.env.SUPERUSER_PASSWORD;
    await ctx.close();
  });

  const getSuperuser = () =>
    ctx.dataSource.getRepository(UserEntity).findOne({ where: { username: 'superuser' } });

  it('crea exactamente un usuario con username = "superuser", idempotente en una segunda corrida', async () => {
    const seed = ctx.app.get(SuperuserSeedService);
    await seed.run();
    await seed.run();

    const rows = await ctx.dataSource.getRepository(UserEntity).find({
      where: { username: 'superuser' },
    });
    expect(rows).toHaveLength(1);
  });

  it('carga un holding de 100 tokens por cada jugador del catálogo', async () => {
    const superuser = await getSuperuser();
    const holdings = await ctx.dataSource
      .getRepository(TokenHoldingEntity)
      .find({ where: { userId: superuser!.id } });

    expect(holdings).toHaveLength(PLAYER_FIXTURES.length);
    for (const holding of holdings) {
      expect(holding.quantity).toBe(100);
    }
  });

  it('publica exactamente una orden SELL PENDING de 100 tokens por jugador, al precio de GET /players/:id/valuation', async () => {
    const superuser = await getSuperuser();

    const login = await request(server())
      .post('/auth/login')
      .send({ email: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD });
    const token = login.body.accessToken as string;

    const orders = await ctx.dataSource
      .getRepository(OrderEntity)
      .find({ where: { userId: superuser!.id } });

    expect(orders).toHaveLength(PLAYER_FIXTURES.length);

    for (const order of orders) {
      expect(order.side).toBe('SELL');
      expect(order.status).toBe('PENDING');
      expect(order.quantity).toBe(100);
      expect(order.remainingQuantity).toBe(100);

      const valuation = await request(server())
        .get(`/players/${order.playerId}/valuation`)
        .set('Authorization', `Bearer ${token}`);

      expect(valuation.status).toBe(200);
      expect(Number(order.price)).toBeCloseTo(Number(valuation.body.value), 2);
    }
  });
});

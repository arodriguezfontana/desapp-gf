import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/order-side';
import { UserEntity } from '../auth/entities/user.entity';
import { PlayerEntity } from '../player/entities/player.entity';
import { OrderEntity } from './entities/order.entity';
import { OrderMapper } from './mappers/order.mapper';
import { TypeOrmOrderRepository } from './typeorm-order.repository';

/**
 * Integración (024-player-order-book) contra Postgres real: cubre la query
 * SQL agregada (`GROUP BY side, price` + `SUM(remaining_quantity)`) de
 * `getOrderBook`, la parte más riesgosa de la feature y la única que los
 * unit tests con mocks no pueden probar.
 */
describe('TypeOrmOrderRepository — getOrderBook (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let repository: TypeOrmOrderRepository;
  let dataSource: DataSource;
  let userId: string;
  let otherUserId: string;
  let playerId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([OrderEntity, PlayerEntity, UserEntity]),
      ],
      providers: [OrderMapper, TypeOrmOrderRepository],
    }).compile();

    repository = moduleRef.get(TypeOrmOrderRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM "orders"');
    await dataSource.getRepository(PlayerEntity).clear();
    await dataSource.query('DELETE FROM "users"');
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "orders"');

    userId = randomUUID();
    otherUserId = randomUUID();
    await dataSource.getRepository(UserEntity).insert([
      {
        id: userId,
        email: `${userId}@test.local`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
        username: 'test-user',
      },
      {
        id: otherUserId,
        email: `${otherUserId}@test.local`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
        username: 'other-user',
      },
    ]);

    playerId = randomUUID();
    await dataSource.getRepository(PlayerEntity).save({
      id: playerId,
      name: 'Jugador Test',
      league: 'LA_LIGA',
      team: 'Equipo Test',
      position: 'MF',
      externalId: `ws-${playerId}`,
      removedAt: null,
    });
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM "orders"');
    await dataSource.query('DELETE FROM "users" WHERE id IN ($1, $2)', [userId, otherUserId]);
    await dataSource.getRepository(PlayerEntity).delete({ id: playerId });
  });

  const createOrder = (props: {
    userId: string;
    side: OrderSide;
    quantity: number;
    price: number;
  }): Order =>
    Order.create({
      id: randomUUID(),
      userId: props.userId,
      playerId,
      side: props.side,
      quantity: props.quantity,
      price: props.price,
      createdAt: new Date(),
    });

  it('devuelve bids/asks vacíos para un jugador sin órdenes activas', async () => {
    const book = await repository.getOrderBook(playerId);

    expect(book.bids).toEqual([]);
    expect(book.asks).toEqual([]);
  });

  it('agrupa por nivel de precio sumando remainingQuantity dentro de cada lado', async () => {
    // Dos compras al mismo precio (100): deben consolidarse en un único nivel con totalQuantity = 15.
    await repository.save(createOrder({ userId, side: OrderSide.BUY, quantity: 10, price: 100 }));
    await repository.save(createOrder({ userId: otherUserId, side: OrderSide.BUY, quantity: 5, price: 100 }));
    // Una compra a un precio distinto (90): nivel separado.
    await repository.save(createOrder({ userId, side: OrderSide.BUY, quantity: 3, price: 90 }));
    // Una venta (200): va a asks, no se mezcla con bids.
    await repository.save(createOrder({ userId: otherUserId, side: OrderSide.SELL, quantity: 7, price: 200 }));

    const book = await repository.getOrderBook(playerId);

    expect(book.bids).toEqual([
      { price: 100, totalQuantity: 15 },
      { price: 90, totalQuantity: 3 },
    ]);
    expect(book.asks).toEqual([{ price: 200, totalQuantity: 7 }]);
  });

  it('ordena bids descendente y asks ascendente por precio (orden canónico de mercado)', async () => {
    await repository.save(createOrder({ userId, side: OrderSide.BUY, quantity: 1, price: 80 }));
    await repository.save(createOrder({ userId, side: OrderSide.BUY, quantity: 1, price: 120 }));
    await repository.save(createOrder({ userId, side: OrderSide.BUY, quantity: 1, price: 100 }));

    await repository.save(createOrder({ userId: otherUserId, side: OrderSide.SELL, quantity: 1, price: 150 }));
    await repository.save(createOrder({ userId: otherUserId, side: OrderSide.SELL, quantity: 1, price: 130 }));
    await repository.save(createOrder({ userId: otherUserId, side: OrderSide.SELL, quantity: 1, price: 140 }));

    const book = await repository.getOrderBook(playerId);

    expect(book.bids.map((l) => l.price)).toEqual([120, 100, 80]);
    expect(book.asks.map((l) => l.price)).toEqual([130, 140, 150]);
  });

  it('solo contabiliza el remainingQuantity pendiente de una orden PARTIALLY_FILLED, no la cantidad original', async () => {
    const order = createOrder({ userId, side: OrderSide.SELL, quantity: 10, price: 100 });
    const partiallyFilled = order.fill(4); // remainingQuantity = 6
    await repository.save(partiallyFilled);

    const book = await repository.getOrderBook(playerId);

    expect(book.asks).toEqual([{ price: 100, totalQuantity: 6 }]);
  });

  it('excluye por completo las órdenes COMPLETED y CANCELLED del libro', async () => {
    const completed = createOrder({ userId, side: OrderSide.BUY, quantity: 5, price: 100 }).fill(5);
    const cancelled = createOrder({ userId: otherUserId, side: OrderSide.SELL, quantity: 8, price: 200 }).cancel();
    await repository.save(completed);
    await repository.save(cancelled);

    const book = await repository.getOrderBook(playerId);

    expect(book.bids).toEqual([]);
    expect(book.asks).toEqual([]);
  });

  it('consolida precios con exactitud decimal de dos dígitos sin duplicar niveles', async () => {
    await repository.save(createOrder({ userId, side: OrderSide.BUY, quantity: 2, price: 99.99 }));
    await repository.save(createOrder({ userId: otherUserId, side: OrderSide.BUY, quantity: 3, price: 99.99 }));

    const book = await repository.getOrderBook(playerId);

    expect(book.bids).toEqual([{ price: 99.99, totalQuantity: 5 }]);
  });
});

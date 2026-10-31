import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/enums/order-side';
import { TokenHolding } from '../../domain/portfolio/token-holding';
import { UserEntity } from '../auth/entities/user.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrderMapper } from '../orders/mappers/order.mapper';
import { OrderRepository } from '../orders/order.repository';
import { PlayerEntity } from '../player/entities/player.entity';
import { TokenHoldingEntity } from '../portfolio/entities/token-holding.entity';
import { TokenHoldingMapper } from '../portfolio/mappers/token-holding.mapper';
import { TokenHoldingRepository } from '../portfolio/token-holding.repository';
import { TransactionManager } from './transaction-manager';

/**
 * Integración contra Postgres real: demuestra la atomicidad (constitución,
 * Principio VI). Varias escrituras hechas con los métodos `*InTransaction`
 * dentro de `TransactionManager.run` se confirman todas juntas si el bloque
 * termina bien, y se descartan todas juntas si lanza una excepción.
 */
describe('TransactionManager — atomicidad (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let transactionManager: TransactionManager;
  let orders: OrderRepository;
  let holdings: TokenHoldingRepository;
  let dataSource: DataSource;
  let userId: string;
  let playerId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([OrderEntity, TokenHoldingEntity, PlayerEntity, UserEntity]),
      ],
      providers: [OrderMapper, OrderRepository, TokenHoldingMapper, TokenHoldingRepository, TransactionManager],
    }).compile();

    transactionManager = moduleRef.get(TransactionManager);
    orders = moduleRef.get(OrderRepository);
    holdings = moduleRef.get(TokenHoldingRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    userId = randomUUID();
    await dataSource.getRepository(UserEntity).insert({
      id: userId,
      email: `${userId}@test.local`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
      username: 'test-user',
    });

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
    await dataSource.query('DELETE FROM "orders" WHERE user_id = $1', [userId]);
    await dataSource.query('DELETE FROM "token_holdings" WHERE user_id = $1', [userId]);
    await dataSource.query('DELETE FROM "users" WHERE id = $1', [userId]);
    await dataSource.getRepository(PlayerEntity).delete({ id: playerId });
  });

  const newOrder = () =>
    Order.create({
      id: randomUUID(),
      userId,
      playerId,
      side: OrderSide.BUY,
      quantity: 5,
      price: 50,
      createdAt: new Date(),
    });

  it('si el bloque termina bien, confirma el holding y la orden juntos', async () => {
    const order = newOrder();
    const holding = TokenHolding.createEmpty(userId, playerId).credit(5);

    await transactionManager.run(async (tx) => {
      await holdings.saveInTransaction(tx, holding);
      await orders.saveInTransaction(tx, order);
    });

    expect((await holdings.findByUserAndPlayer(userId, playerId))?.quantity).toBe(5);
    expect(await orders.findById(order.id)).not.toBeNull();
  });

  it('si el bloque lanza un error, no queda guardado ni el holding ni la orden', async () => {
    const order = newOrder();
    const holding = TokenHolding.createEmpty(userId, playerId).credit(5);

    await expect(
      transactionManager.run(async (tx) => {
        await holdings.saveInTransaction(tx, holding);
        await orders.saveInTransaction(tx, order);
        throw new Error('falla a mitad de la operación');
      }),
    ).rejects.toThrow('falla a mitad de la operación');

    expect(await holdings.findByUserAndPlayer(userId, playerId)).toBeNull();
    expect(await orders.findById(order.id)).toBeNull();
  });

  it('el rollback devuelve el holding a su valor anterior', async () => {
    await holdings.save(TokenHolding.createEmpty(userId, playerId).credit(10));

    await expect(
      transactionManager.run(async (tx) => {
        const locked = await holdings.lockForUpdate(tx, userId, playerId);
        await holdings.saveInTransaction(tx, locked.debit(4));
        throw new Error('falla después de debitar');
      }),
    ).rejects.toThrow('falla después de debitar');

    expect((await holdings.findByUserAndPlayer(userId, playerId))?.quantity).toBe(10);
  });

  it('una escritura con el método común (fuera de la transacción) NO se revierte', async () => {
    const order = newOrder();
    const holding = TokenHolding.createEmpty(userId, playerId).credit(5);

    await expect(
      transactionManager.run(async (tx) => {
        await holdings.saveInTransaction(tx, holding);
        await orders.save(order); // usa otra conexión: queda fuera de la transacción
        throw new Error('falla');
      }),
    ).rejects.toThrow('falla');

    expect(await holdings.findByUserAndPlayer(userId, playerId)).toBeNull();
    expect(await orders.findById(order.id)).not.toBeNull();
  });
});

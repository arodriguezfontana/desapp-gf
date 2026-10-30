import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/order-side';
import { OrderStatus } from '../../domain/orders/order-status';
import { OrderNotCancellableError } from '../../domain/orders/errors/order-not-cancellable.error';
import { TypeOrmTransactionManager } from '../shared/typeorm-transaction-manager';
import { UserEntity } from '../auth/entities/user.entity';
import { PlayerEntity } from '../player/entities/player.entity';
import { OrderEntity } from './entities/order.entity';
import { OrderMapper } from './mappers/order.mapper';
import { OrderRepository } from './order.repository';

/**
 * Integración (023-cancel-order) contra Postgres real: cubre el camino que
 * los unit tests con mocks no pueden probar — el lock pesimista real
 * (`SELECT ... FOR UPDATE`) y la exclusión efectiva de órdenes CANCELLED de
 * los cómputos de disponibilidad (`sumPendingSellQuantity`,
 * `findCompatibleCandidates`) a nivel de base de datos.
 */
describe('OrderRepository — cancelación (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let repository: OrderRepository;
  let transactionManager: TypeOrmTransactionManager;
  let dataSource: DataSource;
  let userId: string;
  let playerId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([OrderEntity, PlayerEntity, UserEntity]),
      ],
      providers: [OrderMapper, OrderRepository, TypeOrmTransactionManager],
    }).compile();

    repository = moduleRef.get(OrderRepository);
    transactionManager = moduleRef.get(TypeOrmTransactionManager);
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
    await dataSource.query('DELETE FROM "orders"');
    await dataSource.query('DELETE FROM "users" WHERE id = $1', [userId]);
    await dataSource.getRepository(PlayerEntity).delete({ id: playerId });
  });

  const persistOrder = async (order: Order): Promise<void> => {
    await repository.save(order);
  };

  describe('cancelación vía findByIdWithLock + saveInTransaction', () => {
    it('cancela una orden PENDING: queda CANCELLED y excluida de sumPendingSellQuantity', async () => {
      const order = Order.create({
        id: randomUUID(),
        userId,
        playerId,
        side: OrderSide.SELL,
        quantity: 10,
        price: 100,
        createdAt: new Date(),
      });
      await persistOrder(order);

      const beforeCancel = await repository.sumPendingSellQuantity(userId, playerId);
      expect(beforeCancel).toBe(10);

      const cancelled = await transactionManager.run(async (tx) => {
        const locked = await repository.findByIdWithLock(tx, order.id);
        const result = locked!.cancel();
        await repository.saveInTransaction(tx, result);
        return result;
      });

      expect(cancelled.status).toBe(OrderStatus.CANCELLED);

      const persisted = await repository.findById(order.id);
      expect(persisted!.status).toBe(OrderStatus.CANCELLED);

      // El remanente de la venta cancelada deja de reservar disponibilidad.
      const afterCancel = await repository.sumPendingSellQuantity(userId, playerId);
      expect(afterCancel).toBe(0);
    });

    it('cancela una orden PARTIALLY_FILLED preservando su remainingQuantity ya reducido', async () => {
      const order = Order.create({
        id: randomUUID(),
        userId,
        playerId,
        side: OrderSide.SELL,
        quantity: 10,
        price: 100,
        createdAt: new Date(),
      });
      const partiallyFilled = order.fill(4); // remainingQuantity = 6, status PARTIALLY_FILLED
      await persistOrder(partiallyFilled);

      expect((await repository.findById(order.id))!.status).toBe(OrderStatus.PARTIALLY_FILLED);

      const cancelled = await transactionManager.run(async (tx) => {
        const locked = await repository.findByIdWithLock(tx, order.id);
        const result = locked!.cancel();
        await repository.saveInTransaction(tx, result);
        return result;
      });

      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(cancelled.remainingQuantity).toBe(6); // no se revierten los fills ya ejecutados

      // El remanente restante (6) también se libera al cancelar.
      const afterCancel = await repository.sumPendingSellQuantity(userId, playerId);
      expect(afterCancel).toBe(0);
    });

    it('una orden ya CANCELLED no puede volver a cancelarse (OrderNotCancellableError)', async () => {
      const order = Order.create({
        id: randomUUID(),
        userId,
        playerId,
        side: OrderSide.BUY,
        quantity: 5,
        price: 50,
        createdAt: new Date(),
      });
      await persistOrder(order.cancel());

      await expect(
        transactionManager.run(async (tx) => {
          const locked = await repository.findByIdWithLock(tx, order.id);
          return locked!.cancel();
        }),
      ).rejects.toBeInstanceOf(OrderNotCancellableError);
    });

    it('una orden COMPLETED (remainingQuantity = 0) no puede cancelarse', async () => {
      const order = Order.create({
        id: randomUUID(),
        userId,
        playerId,
        side: OrderSide.BUY,
        quantity: 5,
        price: 50,
        createdAt: new Date(),
      });
      const completed = order.fill(5); // remainingQuantity = 0 -> status COMPLETED (derivado)
      await persistOrder(completed);

      expect((await repository.findById(order.id))!.status).toBe(OrderStatus.COMPLETED);

      await expect(
        transactionManager.run(async (tx) => {
          const locked = await repository.findByIdWithLock(tx, order.id);
          return locked!.cancel();
        }),
      ).rejects.toBeInstanceOf(OrderNotCancellableError);
    });
  });

  describe('exclusión de órdenes CANCELLED del libro de candidatas', () => {
    it('findCompatibleCandidates ignora una orden cancelada aunque el precio y jugador coincidan', async () => {
      const counterpartUserId = randomUUID();
      await dataSource.getRepository(UserEntity).insert({
        id: counterpartUserId,
        email: `${counterpartUserId}@test.local`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
        username: 'counterpart-user',
      });

      const sellOrder = Order.create({
        id: randomUUID(),
        userId: counterpartUserId,
        playerId,
        side: OrderSide.SELL,
        quantity: 10,
        price: 100,
        createdAt: new Date(),
      });
      await persistOrder(sellOrder.cancel());

      const candidates = await repository.findCompatibleCandidates(playerId, OrderSide.SELL, 100, userId);

      expect(candidates).toHaveLength(0);

      await dataSource.query('DELETE FROM "users" WHERE id = $1', [counterpartUserId]);
    });
  });
});

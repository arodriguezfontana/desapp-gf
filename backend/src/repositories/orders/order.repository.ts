import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../domain/orders/order';
import { OrderBook, PriceLevel } from '../../domain/orders/order-book';
import { OrderSide } from '../../domain/orders/order-side';
import { OrderStatus } from '../../domain/orders/order-status';
import { Transaction } from '../shared/transaction';
import { OrderEntity } from './entities/order.entity';
import { OrderMapper } from './mappers/order.mapper';

const OPEN_STATUSES = [OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED];

@Injectable()
export class OrderRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repo: Repository<OrderEntity>,
    private readonly mapper: OrderMapper,
  ) {}

  async findById(id: string): Promise<Order | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const entities = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.mapper.toDomain(e));
  }

  async sumPendingSellQuantity(userId: string, playerId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.remaining_quantity), 0)', 'total')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.player_id = :playerId', { playerId })
      .andWhere('o.side = :side', { side: OrderSide.SELL })
      .andWhere('o.status IN (:...statuses)', { statuses: OPEN_STATUSES })
      .getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }

  async save(order: Order): Promise<Order> {
    await this.repo.save(this.mapper.toEntity(order));
    return order;
  }

  async findByIdWithLock(tx: Transaction, id: string): Promise<Order | null> {
    const entity = await tx.manager
      .getRepository(OrderEntity)
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOne();
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async lockCompatibleCandidates(
    tx: Transaction,
    playerId: string,
    side: OrderSide,
    price: number,
    excludeUserId: string,
  ): Promise<Order[]> {
    const priceOp = side === OrderSide.SELL ? '<=' : '>=';
    const priceOrder = side === OrderSide.SELL ? ('ASC' as const) : ('DESC' as const);
    const entities = await tx.manager
      .getRepository(OrderEntity)
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.player_id = :playerId', { playerId })
      .andWhere('o.side = :side', { side })
      .andWhere(`o.price ${priceOp} :price`, { price: price.toFixed(2) })
      .andWhere('o.status IN (:...statuses)', { statuses: OPEN_STATUSES })
      .andWhere('o.user_id != :excludeUserId', { excludeUserId })
      .orderBy('o.price', priceOrder)
      .addOrderBy('o.created_at', 'ASC')
      .addOrderBy('o.id', 'ASC')
      .getMany();
    return entities.map((e) => this.mapper.toDomain(e));
  }

  async saveInTransaction(tx: Transaction, order: Order): Promise<Order> {
    await tx.manager.getRepository(OrderEntity).save(this.mapper.toEntity(order));
    return order;
  }

  async getOrderBook(playerId: string): Promise<OrderBook> {
    const rawRows = await this.repo
      .createQueryBuilder('o')
      .select('o.side', 'side')
      .addSelect('o.price', 'price')
      .addSelect('COALESCE(SUM(o.remaining_quantity), 0)', 'totalQuantity')
      .where('o.player_id = :playerId', { playerId })
      .andWhere('o.status IN (:...statuses)', { statuses: OPEN_STATUSES })
      .groupBy('o.side')
      .addGroupBy('o.price')
      .getRawMany<{ side: OrderSide; price: string | number; totalQuantity: string | number }>();

    const bids: PriceLevel[] = [];
    const asks: PriceLevel[] = [];

    for (const row of rawRows) {
      const level: PriceLevel = {
        price: Number(Number(row.price).toFixed(2)),
        totalQuantity: Number(row.totalQuantity),
      };
      if (row.side === OrderSide.BUY) {
        bids.push(level);
      } else if (row.side === OrderSide.SELL) {
        asks.push(level);
      }
    }

    return OrderBook.create(playerId, bids, asks);
  }
}

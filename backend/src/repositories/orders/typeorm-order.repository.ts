import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Order } from '../../domain/orders/order';
import { OrderSide } from '../../domain/orders/order-side';
import { OrderStatus } from '../../domain/orders/order-status';
import { Transaction } from '../shared/transaction';
import { OrderEntity } from './entities/order.entity';
import { OrderMapper } from './mappers/order.mapper';
import { OrderRepository } from './order.repository';

const OPEN_STATUSES = [OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED];

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repo: Repository<OrderEntity>,
    private readonly mapper: OrderMapper,
  ) {}

  async findById(id: string): Promise<Order | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findCompatibleCandidates(playerId: string, side: OrderSide, price: number): Promise<Order[]> {
    const priceFilter = side === OrderSide.SELL
      ? LessThanOrEqual(price.toFixed(2))
      : MoreThanOrEqual(price.toFixed(2));
    const priceOrder = side === OrderSide.SELL ? ('ASC' as const) : ('DESC' as const);
    const entities = await this.repo.find({
      where: { playerId, side, price: priceFilter, status: In(OPEN_STATUSES) },
      order: { price: priceOrder, createdAt: 'ASC', id: 'ASC' },
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

  async lockCompatibleCandidates(
    tx: Transaction,
    playerId: string,
    side: OrderSide,
    price: number,
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
}

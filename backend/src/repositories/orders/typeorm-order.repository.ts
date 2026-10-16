import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    const entities = await this.repo.find({
      where: {
        playerId,
        side,
        price: price.toFixed(2),
        status: In(OPEN_STATUSES),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return entities.map((e) => this.mapper.toDomain(e));
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
    const entities = await tx.manager
      .getRepository(OrderEntity)
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.player_id = :playerId', { playerId })
      .andWhere('o.side = :side', { side })
      .andWhere('o.price = :price', { price: price.toFixed(2) })
      .andWhere('o.status IN (:...statuses)', { statuses: OPEN_STATUSES })
      .orderBy('o.created_at', 'ASC')
      .addOrderBy('o.id', 'ASC')
      .getMany();
    return entities.map((e) => this.mapper.toDomain(e));
  }

  async saveInTransaction(tx: Transaction, order: Order): Promise<Order> {
    await tx.manager.getRepository(OrderEntity).save(this.mapper.toEntity(order));
    return order;
  }
}

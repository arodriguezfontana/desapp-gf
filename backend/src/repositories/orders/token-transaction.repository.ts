import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { TokenTransaction } from '../../domain/orders/token-transaction';
import { Transaction } from '../shared/transaction';
import { TokenTransactionEntity } from './entities/token-transaction.entity';
import { TokenTransactionMapper } from './mappers/token-transaction.mapper';

@Injectable()
export class TokenTransactionRepository {
  constructor(
    @InjectRepository(TokenTransactionEntity)
    private readonly repo: Repository<TokenTransactionEntity>,
    private readonly mapper: TokenTransactionMapper,
  ) {}

  async save(transaction: TokenTransaction): Promise<TokenTransaction> {
    await this.repo.insert(this.mapper.toEntity(transaction));
    return transaction;
  }

  async saveInTransaction(tx: Transaction, transaction: TokenTransaction): Promise<TokenTransaction> {
    await tx.manager.getRepository(TokenTransactionEntity).insert(this.mapper.toEntity(transaction));
    return transaction;
  }

  /**
   * Asientos de compraventa del usuario. Excluye el asiento de emision inicial (`order_id` nulo):
   * no es una operacion del usuario, asi que no aparece en el historial ni lo ve la siembra de
   * simulacion (spec 030, FR-017).
   */
  async findByUserId(userId: string): Promise<TokenTransaction[]> {
    const entities = await this.repo.find({
      where: { userId, orderId: Not(IsNull()) },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.mapper.toDomain(e));
  }

  /**
   * CREDIT de compraventa del usuario (base del costo promedio de compra). Excluye la emision
   * inicial: no es una compra y cambiaria el costo promedio del portafolio (spec 030, FR-017).
   */
  async findCreditsByUserId(userId: string): Promise<TokenTransaction[]> {
    const entities = await this.repo.find({
      where: { userId, type: 'CREDIT', orderId: Not(IsNull()) },
      order: { createdAt: 'ASC' },
    });
    return entities.map((e) => this.mapper.toDomain(e));
  }
}

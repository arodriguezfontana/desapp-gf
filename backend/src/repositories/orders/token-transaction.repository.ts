import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async findByUserId(userId: string): Promise<TokenTransaction[]> {
    const entities = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.mapper.toDomain(e));
  }

  async findCreditsByUserId(userId: string): Promise<TokenTransaction[]> {
    const entities = await this.repo.find({
      where: { userId, type: 'CREDIT' },
      order: { createdAt: 'ASC' },
    });
    return entities.map((e) => this.mapper.toDomain(e));
  }
}

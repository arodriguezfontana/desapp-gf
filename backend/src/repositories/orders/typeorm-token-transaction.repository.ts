import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenTransaction } from '../../domain/orders/token-transaction';
import { Transaction } from '../shared/transaction';
import { TokenTransactionEntity } from './entities/token-transaction.entity';
import { TokenTransactionMapper } from './mappers/token-transaction.mapper';
import { TokenTransactionRepository } from './token-transaction.repository';

@Injectable()
export class TypeOrmTokenTransactionRepository implements TokenTransactionRepository {
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
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Transaction } from './transaction';
import { TransactionManager } from './transaction-manager';

/**
 * Implementacion real sobre `DataSource.transaction` (API de alto nivel de
 * TypeORM, research.md D4). Abre una unica transaccion de base de datos;
 * TypeORM hace commit si `work` resuelve y rollback si rechaza.
 */
@Injectable()
export class TypeOrmTransactionManager implements TransactionManager {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) => work({ manager }));
  }
}

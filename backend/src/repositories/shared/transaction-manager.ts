import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Transaction } from './transaction';

/**
 * Abre una unica transaccion de base que puede tocar varios agregados a la vez
 * (Order + TokenHolding + TokenTransaction, ver research.md D4 y constitucion
 * Principio VI). `work` recibe un `Transaction` opaco para pasarselo a los
 * metodos `*InTransaction`/`lock*` de los repositorios involucrados.
 *
 * Se apoya en `DataSource.transaction` (API de alto nivel de TypeORM): hace
 * commit si `work` resuelve y rollback si rechaza (todo o nada).
 */
@Injectable()
export class TransactionManager {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) => work({ manager }));
  }
}

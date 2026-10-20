import { Transaction } from './transaction';

/**
 * Puerto de dominio para abrir una unica transaccion de base que puede tocar
 * varios agregados a la vez (Order + TokenHolding + TokenTransaction, ver
 * research.md D4 y constitucion Principio VI). `work` recibe un `Transaction`
 * opaco para pasarselo a los metodos `*InTransaction`/`lock*` de los
 * repositorios involucrados; si `work` rechaza, toda la transaccion hace
 * rollback (todo o nada).
 */
export interface TransactionManager {
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}

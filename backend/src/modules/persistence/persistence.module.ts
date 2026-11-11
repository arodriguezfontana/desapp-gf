import { Module } from '@nestjs/common';
import { TransactionManager } from '../../repositories/shared/transaction-manager';

/**
 * Infraestructura de persistencia compartida: `TransactionManager` abre la transacción atómica que
 * necesita cualquier operación que toque varios agregados a la vez (constitución, Principio VI).
 * Vive acá, y no en el módulo de órdenes, porque no es de órdenes: lo usan la ejecución de órdenes
 * y la emisión inicial del superusuario.
 */
@Module({
  providers: [TransactionManager],
  exports: [TransactionManager],
})
export class PersistenceModule {}

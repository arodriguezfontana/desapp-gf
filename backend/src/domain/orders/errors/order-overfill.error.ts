import { DomainError } from '../../../shared/errors/domain-error';

/**
 * Invariante de ultimo recurso del dominio (constitucion, Principio III/VI):
 * nunca se puede fillear una Order por mas de lo que le queda pendiente. En
 * el flujo normal el motor de matching (`matchOrder`) nunca intenta esto; si
 * ocurre, es un bug de orquestacion y se rechaza en el dominio, no en el Service.
 */
export class OrderOverfillError extends DomainError {
  constructor() {
    super('No se puede ejecutar una cantidad mayor a la pendiente de la orden.');
  }
}

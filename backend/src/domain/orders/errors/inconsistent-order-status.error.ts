import { DomainError } from '../../../shared/errors/domain-error';

/**
 * Invariante de ultimo recurso del dominio (constitucion, Principio III/VI): el
 * estado de una Order se deriva de su cantidad pendiente y solo `CANCELLED` se
 * almacena. Reconstruir una orden con un estado que contradice su cantidad
 * pendiente (p. ej. COMPLETED con cantidad por ejecutar) es un dato corrupto
 * y se rechaza en vez de corregirse en silencio.
 */
export class InconsistentOrderStatusError extends DomainError {
  constructor() {
    super('El estado de la orden no coincide con su cantidad pendiente.');
  }
}

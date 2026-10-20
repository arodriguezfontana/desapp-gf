import { DomainError } from '../../../shared/errors/domain-error';

/**
 * Invariante de ultimo recurso del dominio: la cantidad de una Order MUST ser
 * un entero positivo. El DTO ya lo valida como forma (Principio III); esta
 * excepcion es la red de seguridad del dominio si algo la construye sin pasar
 * por esa validacion (p. ej. el seed del superusuario).
 */
export class InvalidOrderQuantityError extends DomainError {
  constructor() {
    super('La cantidad de la orden debe ser un entero mayor a cero.');
  }
}

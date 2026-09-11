import { DomainError } from '../../../../shared/errors/domain-error';

/**
 * Se lanza tanto cuando el email no existe como cuando la contraseña no coincide.
 * El mensaje y el status son identicos en ambos casos para no revelar que emails
 * estan registrados (spec FR-012).
 */
export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Credenciales inválidas.');
  }
}

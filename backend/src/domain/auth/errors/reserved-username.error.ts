import { DomainError } from '../../../shared/errors/domain-error';

/**
 * Spec 020-order-matching-engine, FR-002: "superuser" es un valor reservado.
 * Nadie puede registrarse con ese username exacto (409) — es lo que
 * garantiza que exista un unico usuario con ese username (el provisto por
 * SuperuserSeedService).
 */
export class ReservedUsernameError extends DomainError {
  constructor() {
    super('El username "superuser" está reservado y no puede utilizarse para registrarse.');
  }
}

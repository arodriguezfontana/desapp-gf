import { DomainError } from '../../../../shared/errors/domain-error';

export class EmailAlreadyInUseError extends DomainError {
  constructor() {
    super('El email ya está registrado.');
  }
}

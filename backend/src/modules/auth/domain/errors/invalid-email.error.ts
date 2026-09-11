import { DomainError } from '../../../../shared/errors/domain-error';

export class InvalidEmailError extends DomainError {
  constructor() {
    super('El email no tiene un formato válido.');
  }
}

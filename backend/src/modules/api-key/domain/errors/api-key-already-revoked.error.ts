import { DomainError } from '../../../../shared/errors/domain-error';

export class ApiKeyAlreadyRevokedError extends DomainError {
  constructor() {
    super('La ApiKey ya se encuentra revocada.');
  }
}


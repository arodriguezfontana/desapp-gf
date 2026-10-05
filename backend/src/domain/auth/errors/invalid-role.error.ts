import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidRoleError extends DomainError {
  constructor(value: unknown) {
    super(`'${String(value)}' no es un rol válido.`);
  }
}

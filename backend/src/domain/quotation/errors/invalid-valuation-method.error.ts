import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidValuationMethodError extends DomainError {
  constructor(value: string) {
    super(`'${value}' no es un método de valuación válido. Métodos válidos: WEIGHTED, PER_MATCH.`);
  }
}

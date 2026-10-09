import { DomainError } from '../../../shared/errors/domain-error';

export class NoActiveStrategyError extends DomainError {
  constructor() {
    super('No hay ninguna estrategia de valuación activa.');
  }
}

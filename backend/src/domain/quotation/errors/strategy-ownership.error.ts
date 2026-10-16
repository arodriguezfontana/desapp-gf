import { DomainError } from '../../../shared/errors/domain-error';

export class StrategyOwnershipError extends DomainError {
  constructor() {
    super('No tenés permiso para operar sobre esta estrategia.');
  }
}

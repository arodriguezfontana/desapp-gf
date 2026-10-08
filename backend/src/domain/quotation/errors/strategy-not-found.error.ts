import { DomainError } from '../../../shared/errors/domain-error';

export class StrategyNotFoundError extends DomainError {
  constructor(id: string) {
    super(`La estrategia de valuación con id '${id}' no existe.`);
  }
}

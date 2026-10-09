import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidStrategyWeightsError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

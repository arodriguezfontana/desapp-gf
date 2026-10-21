import { DomainError } from '../../../shared/errors/domain-error';

export class OrderForbiddenError extends DomainError {
  constructor() {
    super('No tienes permisos para operar sobre esta orden.');
  }
}


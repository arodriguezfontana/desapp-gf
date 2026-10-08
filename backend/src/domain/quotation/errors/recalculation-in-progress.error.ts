import { DomainError } from '../../../shared/errors/domain-error';

export class RecalculationInProgressError extends DomainError {
  constructor() {
    super('Ya hay un recálculo de cotizaciones en curso.');
  }
}

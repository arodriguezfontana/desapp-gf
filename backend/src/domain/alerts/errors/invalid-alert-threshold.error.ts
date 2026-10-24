import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidAlertThresholdError extends DomainError {
  constructor() {
    super('El valor umbral de la alerta debe ser un número positivo.');
  }
}

import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidAlertConditionError extends DomainError {
  constructor() {
    super('La condición de la alerta debe ser "sube de" o "baja de".');
  }
}

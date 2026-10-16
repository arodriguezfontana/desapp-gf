import { DomainError } from '../../../shared/errors/domain-error';

/** Spec 020-order-matching-engine, FR-010: vender mas tokens de los que se poseen. */
export class InsufficientHoldingError extends DomainError {
  constructor() {
    super('No tenés suficientes tokens de este jugador para esta operación.');
  }
}

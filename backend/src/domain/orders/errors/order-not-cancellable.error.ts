import { DomainError } from '../../../shared/errors/domain-error';

export class OrderNotCancellableError extends DomainError {
  constructor(status?: string) {
    super(
      status
        ? `La orden no se puede cancelar porque su estado actual es ${status}.`
        : 'La orden no se puede cancelar porque ya fue completada o cancelada previamente.',
    );
  }
}


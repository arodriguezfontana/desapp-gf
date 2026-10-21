import { DomainError } from '../../../shared/errors/domain-error';

export class OrderNotFoundError extends DomainError {
  constructor(orderId?: string) {
    super(orderId ? `La orden ${orderId} no existe.` : 'La orden solicitada no existe.');
  }
}


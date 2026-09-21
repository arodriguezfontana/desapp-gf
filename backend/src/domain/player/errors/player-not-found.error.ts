import { DomainError } from '../../../shared/errors/domain-error';

export class PlayerNotFoundError extends DomainError {
  constructor() {
    super('No se encontró el jugador solicitado.');
  }
}

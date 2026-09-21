import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidPositionError extends DomainError {
  constructor(value: string) {
    super(`'${value}' no es una posición válida.`);
  }
}

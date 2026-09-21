import { DomainError } from '../../../shared/errors/domain-error';

export class InvalidLeagueError extends DomainError {
  constructor(value: string) {
    super(`'${value}' no es una liga válida.`);
  }
}

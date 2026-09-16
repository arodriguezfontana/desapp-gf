import { DomainError } from '../../../../shared/errors/domain-error';

export class InvalidApiKeyFormatError extends DomainError {
  constructor() {
    super(
      'El formato de la ApiKey es inválido. Debe comenzar con el prefijo "pmk_" seguido de 64 caracteres hexadecimales.',
    );
  }
}


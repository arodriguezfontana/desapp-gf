import { DomainError } from '../../../../shared/errors/domain-error';

export class InvalidPasswordError extends DomainError {
  constructor() {
    super(
      'La contraseña debe tener entre 8 y 16 caracteres, e incluir al menos una mayúscula, una minúscula, un número y un carácter especial.',
    );
  }
}

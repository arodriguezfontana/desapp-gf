/**
 * Base de todos los errores de dominio. NO extiende HttpException: el dominio no
 * conoce HTTP. El `AllExceptionsFilter` traduce cada subtipo a su status code.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

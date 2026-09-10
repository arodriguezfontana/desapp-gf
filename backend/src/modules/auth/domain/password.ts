import { InvalidPasswordError } from './errors/invalid-password.error';

/**
 * Value object de contraseña en texto plano. Valida la politica de la spec (FR-003)
 * y solo existe de forma transitoria durante el alta: nunca se persiste.
 */
export class Password {
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 16;

  private constructor(private readonly plain: string) {}

  static create(plain: string): Password {
    if (!Password.isValid(plain)) {
      throw new InvalidPasswordError();
    }
    return new Password(plain);
  }

  private static isValid(plain: string): boolean {
    if (typeof plain !== 'string') {
      return false;
    }
    if (plain.length < Password.MIN_LENGTH || plain.length > Password.MAX_LENGTH) {
      return false;
    }
    const hasUpper = /[A-Z]/.test(plain);
    const hasLower = /[a-z]/.test(plain);
    const hasDigit = /[0-9]/.test(plain);
    const hasSpecial = /[^A-Za-z0-9]/.test(plain);
    return hasUpper && hasLower && hasDigit && hasSpecial;
  }

  value(): string {
    return this.plain;
  }
}

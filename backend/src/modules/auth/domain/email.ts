import { InvalidEmailError } from './errors/invalid-email.error';

/**
 * Value object de email. Normaliza (trim + minusculas) y garantiza el formato.
 * La igualdad y la unicidad se evaluan siempre sobre el valor normalizado.
 */
export class Email {
  private static readonly PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(private readonly value: string) {}

  static create(raw: string): Email {
    const normalized = (raw ?? '').trim().toLowerCase();
    if (!Email.PATTERN.test(normalized)) {
      throw new InvalidEmailError();
    }
    return new Email(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

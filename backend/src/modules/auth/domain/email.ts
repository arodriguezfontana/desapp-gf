import { InvalidEmailError } from './errors/invalid-email.error';

/**
 * Value object de email. Normaliza (trim + minusculas) y garantiza el formato.
 * La igualdad y la unicidad se evaluan siempre sobre el valor normalizado.
 */
export class Email {
  // El grupo entre la @ y el punto no excluia el punto de su propia clase de
  // caracteres, lo que generaba ambiguedad de backtracking cuadratico (regla
  // Sonar javascript:S5852 / S6019). Al excluir el punto de ese grupo el corte
  // queda deterministico y la evaluacion es lineal. No cambia la validacion:
  // sigue aceptando dominios con subdominios (el ultimo grupo si admite puntos).
  private static readonly PATTERN = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

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

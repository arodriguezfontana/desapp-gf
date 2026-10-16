import { ReservedUsernameError } from './errors/reserved-username.error';

/**
 * Value object de username (020-order-matching-engine, research.md D1).
 * A diferencia de `Email`, el campo no tiene restriccion de formato ni de
 * unicidad: la unica regla es que el valor exacto "superuser" esta
 * reservado. Se normaliza solo con `trim()` (sin lowercasing: la spec no
 * pide case-insensitivity, asi que "Superuser" SI es un username valido).
 *
 * Este VO es transitorio (como `Password`): se usa unicamente para validar
 * en el flujo de alta (`AuthService.register`); `User` guarda el string
 * plano, no esta instancia (data-model.md: `username: string`). El seed del
 * superusuario (`SuperuserSeedService`) es la unica via legitima que crea un
 * usuario con username = "superuser" y lo hace sin pasar por `Username.create`.
 */
export class Username {
  private static readonly RESERVED = 'superuser';

  private constructor(private readonly raw: string) {}

  /** @throws ReservedUsernameError si el valor normalizado es exactamente "superuser". */
  static create(raw: string): Username {
    const normalized = (raw ?? '').trim();
    if (normalized === Username.RESERVED) {
      throw new ReservedUsernameError();
    }
    return new Username(normalized);
  }

  value(): string {
    return this.raw;
  }
}

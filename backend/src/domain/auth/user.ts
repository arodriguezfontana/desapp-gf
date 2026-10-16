import { Email } from './email';
import { parseUserRole, UserRole } from './user-role';

/**
 * Entidad de dominio Usuario. Sin decoradores de TypeORM ni conocimiento de HTTP
 * o base de datos (constitucion, Principio I). La politica de contraseña ya se
 * valido sobre el texto plano antes de llegar aca; el User solo guarda el hash.
 */
export class User {
  private constructor(
    private readonly _id: string,
    private readonly _email: Email,
    private readonly _passwordHash: string,
    private readonly _createdAt: Date,
    private readonly _role: UserRole,
    private readonly _username: string,
  ) {}

  /**
   * `role` por default es `user`; sólo el seed del primer admin pasa `admin`.
   * `username` (020-order-matching-engine, data-model.md) es opcional por
   * compatibilidad con los call sites existentes de este constructor que no
   * lo conocían todavía; `AuthService.register` y los seeds SIEMPRE lo pasan
   * explícito — la validación del valor reservado "superuser" vive en
   * `Username.create`, no acá (research.md D1: este `register` no revalida
   * el valor reservado, así que el seed del superusuario puede usarlo
   * directamente).
   */
  static register(
    id: string,
    email: Email,
    passwordHash: string,
    createdAt: Date,
    role: UserRole = UserRole.USER,
    username = '',
  ): User {
    return new User(id, email, passwordHash, createdAt, parseUserRole(role), username);
  }

  get id(): string {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get role(): UserRole {
    return this._role;
  }

  get username(): string {
    return this._username;
  }
}

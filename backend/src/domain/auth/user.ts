import { Email } from './email';

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
  ) {}

  static register(
    id: string,
    email: Email,
    passwordHash: string,
    createdAt: Date,
  ): User {
    return new User(id, email, passwordHash, createdAt);
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
}

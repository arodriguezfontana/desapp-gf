import { ApiKeyAlreadyRevokedError } from './errors/api-key-already-revoked.error';
import { parseUserRole, UserRole } from '../auth/user-role';

/**
 * Entidad de dominio ApiKey. Sin decoradores de TypeORM ni conocimiento de HTTP
 * o base de datos (constitucion, Principio I). Solo conoce el hash, nunca el
 * valor en texto plano (ese lo genera `generateRawApiKey` transitoriamente al emitirse).
 *
 * `role` es el rol de quien emitió la clave, copiado en el momento de emitirla
 * (spec 008, FR-009/FR-010/FR-011). No cambia después: la clave se autoriza
 * sola, sin consultar al Usuario en cada request.
 */
export class ApiKey {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _keyHash: string,
    private readonly _createdAt: Date,
    private _revokedAt: Date | null,
    private readonly _role: UserRole,
  ) {}

  static issue(
    id: string,
    userId: string,
    keyHash: string,
    createdAt: Date,
    role: UserRole,
  ): ApiKey {
    return new ApiKey(id, userId, keyHash, createdAt, null, parseUserRole(role));
  }

  /** Reconstruye una ApiKey persistida (usado exclusivamente por ApiKeyMapper). */
  static restore(
    id: string,
    userId: string,
    keyHash: string,
    createdAt: Date,
    revokedAt: Date | null,
    role: UserRole,
  ): ApiKey {
    return new ApiKey(id, userId, keyHash, createdAt, revokedAt, parseUserRole(role));
  }

  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get keyHash(): string {
    return this._keyHash;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }

  get role(): UserRole {
    return this._role;
  }

  isActive(): boolean {
    return this._revokedAt === null;
  }

  /** @throws ApiKeyAlreadyRevokedError si ya estaba revocada */
  revoke(revokedAt: Date): void {
    if (this._revokedAt !== null) {
      throw new ApiKeyAlreadyRevokedError();
    }
    this._revokedAt = revokedAt;
  }
}

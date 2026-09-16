import { ApiKeyAlreadyRevokedError } from './errors/api-key-already-revoked.error';

/**
 * Entidad de dominio ApiKey. Sin decoradores de TypeORM ni conocimiento de HTTP
 * o base de datos (constitucion, Principio I). Solo conoce el hash, nunca el
 * valor en texto plano (ese vive transitoriamente en RawApiKey).
 */
export class ApiKey {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _keyHash: string,
    private readonly _createdAt: Date,
    private _revokedAt: Date | null,
  ) {}

  static issue(
    id: string,
    userId: string,
    keyHash: string,
    createdAt: Date,
  ): ApiKey {
    return new ApiKey(id, userId, keyHash, createdAt, null);
  }

  /** Reconstruye una ApiKey persistida (usado exclusivamente por ApiKeyMapper). */
  static restore(
    id: string,
    userId: string,
    keyHash: string,
    createdAt: Date,
    revokedAt: Date | null,
  ): ApiKey {
    return new ApiKey(id, userId, keyHash, createdAt, revokedAt);
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

import { ApiKey } from './api-key';
import { UserRole } from '../auth/user-role';
import { InvalidRoleError } from '../auth/errors/invalid-role.error';
import { ApiKeyAlreadyRevokedError } from './errors/api-key-already-revoked.error';

describe('ApiKey', () => {
  const createdAt = new Date('2026-09-15T14:03:22.000Z');

  describe('issue', () => {
    it('inicializa la clave en estado activo', () => {
      const apiKey = ApiKey.issue('id-1', 'user-1', 'hash-abc', createdAt, UserRole.USER);

      expect(apiKey.id).toBe('id-1');
      expect(apiKey.userId).toBe('user-1');
      expect(apiKey.keyHash).toBe('hash-abc');
      expect(apiKey.createdAt).toBe(createdAt);
      expect(apiKey.revokedAt).toBeNull();
      expect(apiKey.isActive()).toBe(true);
    });

    it('no expone ningún secreto en texto plano por sus accessors', () => {
      const apiKey = ApiKey.issue('id-1', 'user-1', 'hash-abc', createdAt, UserRole.USER);
      expect(Object.values(apiKey as unknown as Record<string, unknown>)).not.toContain(
        'pmk_texto-plano',
      );
    });
  });

  describe('role', () => {
    it('copia el rol del emisor tal como se pasó a issue', () => {
      const admin = ApiKey.issue('id-2', 'user-1', 'hash-admin', createdAt, UserRole.ADMIN);
      expect(admin.role).toBe(UserRole.ADMIN);
    });

    it('conserva el rol al revocarse', () => {
      const apiKey = ApiKey.issue('id-3', 'user-1', 'hash-abc', createdAt, UserRole.USER);
      apiKey.revoke(new Date());
      expect(apiKey.role).toBe(UserRole.USER);
    });

    it('rechaza un rol inválido con InvalidRoleError', () => {
      expect(() =>
        ApiKey.issue('id-4', 'user-1', 'hash-abc', createdAt, 'root' as UserRole),
      ).toThrow(InvalidRoleError);
    });
  });

  describe('revoke', () => {
    it('marca la clave como revocada e inactiva', () => {
      const apiKey = ApiKey.issue('id-1', 'user-1', 'hash-abc', createdAt, UserRole.USER);
      const revokedAt = new Date('2026-09-15T15:00:00.000Z');

      apiKey.revoke(revokedAt);

      expect(apiKey.revokedAt).toBe(revokedAt);
      expect(apiKey.isActive()).toBe(false);
    });

    it('lanza ApiKeyAlreadyRevokedError si ya estaba revocada', () => {
      const apiKey = ApiKey.issue('id-1', 'user-1', 'hash-abc', createdAt, UserRole.USER);
      apiKey.revoke(new Date());

      expect(() => apiKey.revoke(new Date())).toThrow(ApiKeyAlreadyRevokedError);
    });
  });
});

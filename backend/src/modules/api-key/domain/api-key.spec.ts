import { ApiKey } from './api-key';
import { ApiKeyAlreadyRevokedError } from './errors/api-key-already-revoked.error';

describe('ApiKey', () => {
  const createdAt = new Date('2026-09-15T14:03:22.000Z');

  describe('issue', () => {
    it('inicializa la clave en estado activo', () => {
      const apiKey = ApiKey.issue('id-1', 'user-1', 'hash-abc', createdAt);

      expect(apiKey.id).toBe('id-1');
      expect(apiKey.userId).toBe('user-1');
      expect(apiKey.keyHash).toBe('hash-abc');
      expect(apiKey.createdAt).toBe(createdAt);
      expect(apiKey.revokedAt).toBeNull();
      expect(apiKey.isActive()).toBe(true);
    });

    it('no expone ningún secreto en texto plano por sus accessors', () => {
      const apiKey = ApiKey.issue('id-1', 'user-1', 'hash-abc', createdAt);
      expect(Object.values(apiKey as unknown as Record<string, unknown>)).not.toContain(
        'pmk_texto-plano',
      );
    });
  });

  describe('revoke', () => {
    it('marca la clave como revocada e inactiva', () => {
      const apiKey = ApiKey.issue('id-1', 'user-1', 'hash-abc', createdAt);
      const revokedAt = new Date('2026-09-15T15:00:00.000Z');

      apiKey.revoke(revokedAt);

      expect(apiKey.revokedAt).toBe(revokedAt);
      expect(apiKey.isActive()).toBe(false);
    });

    it('lanza ApiKeyAlreadyRevokedError si ya estaba revocada', () => {
      const apiKey = ApiKey.issue('id-1', 'user-1', 'hash-abc', createdAt);
      apiKey.revoke(new Date());

      expect(() => apiKey.revoke(new Date())).toThrow(ApiKeyAlreadyRevokedError);
    });
  });
});

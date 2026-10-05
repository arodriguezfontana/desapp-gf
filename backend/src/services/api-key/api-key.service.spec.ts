import { TokenHasher } from '../../adapters/api-key/token-hasher';
import { ApiKey } from '../../domain/api-key/api-key';
import { Email } from '../../domain/auth/email';
import { User } from '../../domain/auth/user';
import { UserRole } from '../../domain/auth/user-role';
import { ApiKeyRepository } from '../../repositories/api-key/api-key.repository';
import { ApiKeyService } from './api-key.service';

describe('ApiKeyService', () => {
  let repo: jest.Mocked<ApiKeyRepository>;
  let hasher: jest.Mocked<TokenHasher>;
  let service: ApiKeyService;

  const userWith = (id: string, role: UserRole) =>
    User.register(id, Email.create(`${id}@mail.com`), 'hash-usuario', new Date(), role);

  beforeEach(() => {
    repo = {
      findActiveByUserId: jest.fn(),
      findByHash: jest.fn(),
      save: jest.fn(),
      saveWithRevocation: jest.fn(),
    };
    hasher = { hash: jest.fn(), compare: jest.fn() };
    service = new ApiKeyService(repo, hasher);
  });

  describe('issueApiKey', () => {
    it('emite una clave nueva cuando el usuario no tiene una previa activa', async () => {
      repo.findActiveByUserId.mockResolvedValue(null);
      hasher.hash.mockReturnValue('hash-nueva');

      const { apiKey, rawApiKey } = await service.issueApiKey(userWith('user-1', UserRole.USER));

      expect(hasher.hash).toHaveBeenCalledWith(rawApiKey);
      expect(rawApiKey).toMatch(/^pmk_[0-9a-f]{64}$/);
      expect(apiKey.userId).toBe('user-1');
      expect(apiKey.keyHash).toBe('hash-nueva');
      expect(apiKey.isActive()).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(apiKey);
      expect(repo.saveWithRevocation).not.toHaveBeenCalled();
    });

    it('rota la clave existente: revoca la previa y persiste ambas atómicamente', async () => {
      const previousKey = ApiKey.issue(
        'id-prev',
        'user-1',
        'hash-vieja',
        new Date('2026-01-01T00:00:00.000Z'),
        UserRole.USER,
      );
      repo.findActiveByUserId.mockResolvedValue(previousKey);
      hasher.hash.mockReturnValue('hash-nueva');

      const { apiKey } = await service.issueApiKey(userWith('user-1', UserRole.USER));

      expect(previousKey.isActive()).toBe(false);
      expect(repo.saveWithRevocation).toHaveBeenCalledWith(apiKey, previousKey);
      expect(repo.save).not.toHaveBeenCalled();
    });

    describe('rol copiado (spec 008, US3)', () => {
      it('una clave emitida por un admin queda con rol admin', async () => {
        repo.findActiveByUserId.mockResolvedValue(null);
        hasher.hash.mockReturnValue('hash');

        const { apiKey } = await service.issueApiKey(userWith('admin-1', UserRole.ADMIN));

        expect(apiKey.role).toBe(UserRole.ADMIN);
      });

      it('una clave emitida por un user queda con rol user', async () => {
        repo.findActiveByUserId.mockResolvedValue(null);
        hasher.hash.mockReturnValue('hash');

        const { apiKey } = await service.issueApiKey(userWith('user-1', UserRole.USER));

        expect(apiKey.role).toBe(UserRole.USER);
      });

      it('en una rotación, la clave nueva toma el rol vigente del usuario en ese momento', async () => {
        const previousKey = ApiKey.issue('id-prev', 'user-1', 'hash-vieja', new Date(), UserRole.USER);
        repo.findActiveByUserId.mockResolvedValue(previousKey);
        hasher.hash.mockReturnValue('hash-nueva');

        // El usuario fue promovido después de su clave previa: la rotación toma admin.
        const { apiKey } = await service.issueApiKey(userWith('user-1', UserRole.ADMIN));

        expect(apiKey.role).toBe(UserRole.ADMIN);
        expect(previousKey.role).toBe(UserRole.USER);
      });
    });
  });
});

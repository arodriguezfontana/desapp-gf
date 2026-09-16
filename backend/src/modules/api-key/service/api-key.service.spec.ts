import { TokenHasher } from '../adapters/token-hasher';
import { ApiKey } from '../domain/api-key';
import { ApiKeyRepository } from '../repository/api-key.repository';
import { ApiKeyService } from './api-key.service';

describe('ApiKeyService', () => {
  let repo: jest.Mocked<ApiKeyRepository>;
  let hasher: jest.Mocked<TokenHasher>;
  let service: ApiKeyService;

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

      const { apiKey, rawApiKey } = await service.issueApiKey('user-1');

      expect(hasher.hash).toHaveBeenCalledWith(rawApiKey.toPlainText());
      expect(rawApiKey.toPlainText()).toMatch(/^pmk_[0-9a-f]{64}$/);
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
      );
      repo.findActiveByUserId.mockResolvedValue(previousKey);
      hasher.hash.mockReturnValue('hash-nueva');

      const { apiKey } = await service.issueApiKey('user-1');

      expect(previousKey.isActive()).toBe(false);
      expect(repo.saveWithRevocation).toHaveBeenCalledWith(apiKey, previousKey);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});

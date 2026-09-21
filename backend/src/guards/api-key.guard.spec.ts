import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { TokenHasher } from '../adapters/token-hasher';
import { ApiKeyRepository } from '../repositories/api-key.repository';
import { ApiKey } from '../domain/api-key/api-key';

describe('ApiKeyGuard', () => {
  let hasher: jest.Mocked<TokenHasher>;
  let apiKeys: jest.Mocked<ApiKeyRepository>;
  let guard: ApiKeyGuard;

  const buildContext = (apiKeyHeader?: string): ExecutionContext => {
    const request = {
      headers: apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    hasher = { hash: jest.fn(), compare: jest.fn() };
    apiKeys = {
      findActiveByUserId: jest.fn(),
      findByHash: jest.fn(),
      save: jest.fn(),
      saveWithRevocation: jest.fn(),
    };
    guard = new ApiKeyGuard(hasher, apiKeys);
  });

  it('401 si no hay header x-api-key', async () => {
    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it('401 si el hash de la ApiKey no matchea ninguna guardada (inexistente/adulterada/mal formada)', async () => {
    hasher.hash.mockReturnValue('hash-sin-match');
    apiKeys.findByHash.mockResolvedValue(null);

    await expect(
      guard.canActivate(buildContext('pmk_cualquier-cosa')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('401 si la ApiKey existe pero fue revocada (reemplazada por una emisión posterior)', async () => {
    hasher.hash.mockReturnValue('hash-revocada');
    const revoked = ApiKey.issue('id-1', 'user-1', 'hash-revocada', new Date());
    revoked.revoke(new Date());
    apiKeys.findByHash.mockResolvedValue(revoked);

    await expect(
      guard.canActivate(buildContext('pmk_revocada')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('deja pasar cuando la ApiKey existe y está activa', async () => {
    hasher.hash.mockReturnValue('hash-activa');
    const active = ApiKey.issue('id-1', 'user-1', 'hash-activa', new Date());
    apiKeys.findByHash.mockResolvedValue(active);

    await expect(
      guard.canActivate(buildContext('pmk_activa')),
    ).resolves.toBe(true);
  });
});

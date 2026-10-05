import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { TokenHasher } from '../../adapters/api-key/token-hasher';
import { ApiKey } from '../../domain/api-key/api-key';
import { UserRole } from '../../domain/auth/user-role';
import { ApiKeyRepository } from '../../repositories/api-key/api-key.repository';
import { FORBIDDEN_ROLE_MESSAGE, UNAUTHENTICATED_MESSAGE } from '../../shared/errors/messages';

describe('AdminApiKeyGuard', () => {
  let hasher: jest.Mocked<TokenHasher>;
  let apiKeys: jest.Mocked<ApiKeyRepository>;
  let guard: AdminApiKeyGuard;

  const buildContext = (apiKeyHeader?: string): ExecutionContext => {
    const request = {
      headers: apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  const keyWithRole = (role: UserRole, revoked = false): ApiKey => {
    const key = ApiKey.issue('id-1', 'user-1', 'hash-clave', new Date(), role);
    if (revoked) key.revoke(new Date());
    return key;
  };

  beforeEach(() => {
    hasher = { hash: jest.fn().mockReturnValue('hash-clave'), compare: jest.fn() };
    apiKeys = {
      findActiveByUserId: jest.fn(),
      findByHash: jest.fn(),
      save: jest.fn(),
      saveWithRevocation: jest.fn(),
    };
    guard = new AdminApiKeyGuard(hasher, apiKeys);
  });

  it('401 si no hay header x-api-key', async () => {
    await expect(guard.canActivate(buildContext())).rejects.toThrow(UnauthorizedException);
    expect(apiKeys.findByHash).not.toHaveBeenCalled();
  });

  it('401 si la clave no matchea ninguna guardada', async () => {
    apiKeys.findByHash.mockResolvedValue(null);

    await expect(guard.canActivate(buildContext('pmk_inexistente'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('401 si la clave fue revocada, aunque su rol fuera admin', async () => {
    apiKeys.findByHash.mockResolvedValue(keyWithRole(UserRole.ADMIN, true));

    await expect(guard.canActivate(buildContext('pmk_revocada'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('403 si la clave activa tiene rol user', async () => {
    apiKeys.findByHash.mockResolvedValue(keyWithRole(UserRole.USER));

    const attempt = guard.canActivate(buildContext('pmk_de-user'));

    await expect(attempt).rejects.toThrow(ForbiddenException);
    await expect(attempt).rejects.toThrow(FORBIDDEN_ROLE_MESSAGE);
  });

  it('deja pasar cuando la clave activa tiene rol admin', async () => {
    apiKeys.findByHash.mockResolvedValue(keyWithRole(UserRole.ADMIN));

    await expect(guard.canActivate(buildContext('pmk_de-admin'))).resolves.toBe(true);
  });

  it('decide por el rol de la clave: no consulta ningún repositorio de usuarios', async () => {
    apiKeys.findByHash.mockResolvedValue(keyWithRole(UserRole.ADMIN));

    await guard.canActivate(buildContext('pmk_de-admin'));

    // El guard sólo recibe el repositorio de ApiKeys: no hay forma de consultar al Usuario.
    expect(Object.keys(guard)).not.toContain('users');
    expect(apiKeys.findByHash).toHaveBeenCalledTimes(1);
  });

  it('los 401 usan el mensaje único de autenticación', async () => {
    apiKeys.findByHash.mockResolvedValue(null);

    await expect(guard.canActivate(buildContext('pmk_x'))).rejects.toThrow(UNAUTHENTICATED_MESSAGE);
  });
});

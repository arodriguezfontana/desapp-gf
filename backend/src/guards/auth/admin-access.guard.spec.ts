import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminAccessGuard } from './admin-access.guard';
import { TokenHasher } from '../../adapters/api-key/token-hasher';
import { TokenIssuer } from '../../adapters/auth/token-issuer';
import { ApiKeyRepository } from '../../repositories/api-key/api-key.repository';
import { UserRepository } from '../../repositories/auth/user.repository';
import { UserRole } from '../../domain/auth/user-role';
import { ApiKey } from '../../domain/api-key/api-key';
import { User } from '../../domain/auth/user';
import { Email } from '../../domain/auth/email';

describe('AdminAccessGuard', () => {
  let guard: AdminAccessGuard;
  let hasher: jest.Mocked<TokenHasher>;
  let apiKeys: jest.Mocked<ApiKeyRepository>;
  let tokenIssuer: jest.Mocked<TokenIssuer>;
  let users: jest.Mocked<UserRepository>;

  beforeEach(() => {
    hasher = { hash: jest.fn() } as unknown as jest.Mocked<TokenHasher>;
    apiKeys = {
      findByHash: jest.fn(),
      save: jest.fn(),
      revoke: jest.fn(),
    } as unknown as jest.Mocked<ApiKeyRepository>;
    tokenIssuer = {
      issue: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<TokenIssuer>;
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    guard = new AdminAccessGuard(hasher, apiKeys, tokenIssuer, users);
  });

  function mockContext(headers: Record<string, string>): {
    context: ExecutionContext;
    request: { headers: Record<string, string>; user?: { userId: string } };
  } {
    const request = { headers, user: undefined };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('permite acceso con ApiKey activa de admin', async () => {
    const { context, request } = mockContext({ 'x-api-key': 'fval_adminkey' });
    hasher.hash.mockReturnValue('hash123');
    apiKeys.findByHash.mockResolvedValue(
      ApiKey.issue('key-1', 'admin-id-1', 'hash123', new Date(), UserRole.ADMIN),
    );

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({ userId: 'admin-id-1' });
  });

  it('rechaza con 403 si la ApiKey no tiene rol admin', async () => {
    const { context } = mockContext({ 'x-api-key': 'fval_userkey' });
    hasher.hash.mockReturnValue('hash456');
    apiKeys.findByHash.mockResolvedValue(
      ApiKey.issue('key-2', 'user-id-2', 'hash456', new Date(), UserRole.USER),
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza con 401 si la ApiKey no existe o está revocada', async () => {
    const { context } = mockContext({ 'x-api-key': 'fval_revoked' });
    hasher.hash.mockReturnValue('hash_rev');
    const revokedKey = ApiKey.issue('key-3', 'admin-id-1', 'hash_rev', new Date(), UserRole.ADMIN);
    revokedKey.revoke(new Date());
    apiKeys.findByHash.mockResolvedValue(revokedKey);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('permite acceso con Bearer JWT de usuario admin', async () => {
    const { context, request } = mockContext({ authorization: 'Bearer valid.jwt.token' });
    tokenIssuer.verify.mockReturnValue({ userId: 'admin-id-1' });
    const adminUser = User.register(
      'admin-id-1',
      Email.create('admin@fútval.com'),
      'hash',
      new Date(),
      UserRole.ADMIN,
      'admin',
    );
    users.findById.mockResolvedValue(adminUser);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({ userId: 'admin-id-1' });
  });

  it('rechaza con 403 si el Bearer JWT pertenece a un usuario común (no admin)', async () => {
    const { context } = mockContext({ authorization: 'Bearer user.jwt.token' });
    tokenIssuer.verify.mockReturnValue({ userId: 'regular-user-id' });
    const regularUser = User.register(
      'regular-user-id',
      Email.create('user@fútval.com'),
      'hash',
      new Date(),
      UserRole.USER,
      'regular',
    );
    users.findById.mockResolvedValue(regularUser);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza con 401 si el Bearer JWT es inválido', async () => {
    const { context } = mockContext({ authorization: 'Bearer invalid.token' });
    tokenIssuer.verify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza con 401 si no se envía ningún encabezado de autenticación', async () => {
    const { context } = mockContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});


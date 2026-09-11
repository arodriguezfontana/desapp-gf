import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenIssuer } from '../adapters/token-issuer';
import { UserRepository } from '../repository/user.repository';
import { User } from '../domain/user';
import { Email } from '../domain/email';

describe('JwtAuthGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let tokens: jest.Mocked<TokenIssuer>;
  let users: jest.Mocked<UserRepository>;
  let guard: JwtAuthGuard;

  const buildContext = (authorization?: string): ExecutionContext => {
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers: authorization ? { authorization } : {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  };

  const user = User.register('id-1', Email.create('ana@mail.com'), 'h', new Date());

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    tokens = { issue: jest.fn(), verify: jest.fn() };
    users = {
      findByEmail: jest.fn(),
      existsByEmail: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
    };
    guard = new JwtAuthGuard(reflector as unknown as Reflector, tokens, users);
  });

  it('deja pasar los endpoints @Public() sin mirar el header', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(tokens.verify).not.toHaveBeenCalled();
  });

  it('401 si no hay header Authorization', async () => {
    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('401 si el esquema no es Bearer', async () => {
    await expect(
      guard.canActivate(buildContext('Basic abc')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('401 si verify lanza (token inválido o vencido)', async () => {
    tokens.verify.mockImplementation(() => {
      throw new Error('invalid');
    });
    await expect(
      guard.canActivate(buildContext('Bearer xxx')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('401 si el usuario del token ya no existe (FR-019)', async () => {
    tokens.verify.mockReturnValue({ userId: 'id-1' });
    users.findById.mockResolvedValue(null);
    await expect(
      guard.canActivate(buildContext('Bearer valid')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('adjunta request.user cuando el token es válido y el usuario existe', async () => {
    tokens.verify.mockReturnValue({ userId: 'id-1' });
    users.findById.mockResolvedValue(user);
    const ctx = buildContext('Bearer valid');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const request = ctx.switchToHttp().getRequest<{ user: { userId: string } }>();
    expect(request.user).toEqual({ userId: 'id-1' });
  });
});

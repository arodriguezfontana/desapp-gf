import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { API_KEY_REPOSITORY, TOKEN_HASHER } from '../../modules/api-key/api-key.constants';
import { TOKEN_ISSUER, USER_REPOSITORY } from '../../modules/auth/auth.constants';
import { TokenHasher } from '../../adapters/api-key/token-hasher';
import { TokenIssuer } from '../../adapters/auth/token-issuer';
import { UserRole } from '../../domain/auth/user-role';
import { ApiKeyRepository } from '../../repositories/api-key/api-key.repository';
import { UserRepository } from '../../repositories/auth/user.repository';
import { FORBIDDEN_ROLE_MESSAGE, UNAUTHENTICATED_MESSAGE } from '../../shared/errors/messages';
import { AuthenticatedRequest } from './authenticated-request';

/**
 * Guard flexible de acceso de administrador.
 * Permite autenticarse mediante:
 *  1. Header `X-Api-Key` correspondiente a un ApiKey activo con rol ADMIN.
 *  2. Header `Authorization: Bearer <jwt>` correspondiente a un usuario con rol ADMIN.
 *
 * Si ninguno está presente o no es válido, retorna 401 Unauthorized o 403 Forbidden.
 */
@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_HASHER) private readonly hasher: TokenHasher,
    @Inject(API_KEY_REPOSITORY) private readonly apiKeys: ApiKeyRepository,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 1. Probar ApiKey si viene en los headers
    const rawApiKey = request.headers['x-api-key'];
    if (typeof rawApiKey === 'string' && rawApiKey.trim().length > 0) {
      const hash = this.hasher.hash(rawApiKey.trim());
      const apiKey = await this.apiKeys.findByHash(hash);

      if (!apiKey || !apiKey.isActive()) {
        throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
      }

      if (apiKey.role !== UserRole.ADMIN) {
        throw new ForbiddenException(FORBIDDEN_ROLE_MESSAGE);
      }

      request.user = { userId: apiKey.userId };
      return true;
    }

    // 2. Probar JWT Bearer token si viene en los headers
    const authHeader = request.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      let userId: string;
      try {
        const payload = this.tokenIssuer.verify(token);
        userId = payload.userId;
      } catch {
        throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
      }

      const user = await this.users.findById(userId);
      if (!user) {
        throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
      }

      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException(FORBIDDEN_ROLE_MESSAGE);
      }

      request.user = { userId: user.id };
      return true;
    }

    // Ninguna credencial suministrada
    throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
  }
}

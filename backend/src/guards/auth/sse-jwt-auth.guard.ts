import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { TOKEN_ISSUER, USER_REPOSITORY } from '../../modules/auth/auth.constants';
import { TokenIssuer } from '../../adapters/auth/token-issuer';
import { UserRepository } from '../../repositories/auth/user.repository';
import { UNAUTHENTICATED_MESSAGE } from '../../shared/errors/messages';
import { AuthenticatedRequest } from './authenticated-request';

/**
 * Variante de JwtAuthGuard para GET /notifications/stream
 * (025-player-price-alerts, research.md §2): el JWT viaja como query param
 * `token` porque el EventSource nativo del browser no permite headers
 * custom. Fuera de este endpoint puntual, el mecanismo estándar
 * (header Authorization) sigue siendo el único soportado.
 */
@Injectable()
export class SseJwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.query['token'];
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
    }

    let userId: string;
    try {
      userId = this.tokens.verify(token).userId;
    } catch {
      throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException(UNAUTHENTICATED_MESSAGE);
    }

    request.user = { userId: user.id };
    return true;
  }
}

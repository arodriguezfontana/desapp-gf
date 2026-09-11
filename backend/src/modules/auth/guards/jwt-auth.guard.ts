import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TOKEN_ISSUER, USER_REPOSITORY } from '../auth.constants';
import { TokenIssuer } from '../adapters/token-issuer';
import { UserRepository } from '../repository/user.repository';
import { AuthenticatedRequest } from './authenticated-request';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Guard global (constitucion, Principio IV). Exige un JWT valido y vigente en
 * todo endpoint que no este marcado @Public(). Sin token, con uno invalido o
 * vencido, o si el usuario del token ya no existe -> 401 (spec FR-015..FR-019).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('No autenticado.');
    }

    let userId: string;
    try {
      userId = this.tokens.verify(token).userId;
    } catch {
      throw new UnauthorizedException('No autenticado.');
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('No autenticado.');
    }

    request.user = { userId: user.id };
    return true;
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    if (scheme !== 'Bearer' || !value) {
      return null;
    }
    return value;
  }
}

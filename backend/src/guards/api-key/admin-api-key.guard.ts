import {
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';

import { API_KEY_REPOSITORY, TOKEN_HASHER } from '../../modules/api-key/api-key.constants';
import { TokenHasher } from '../../adapters/api-key/token-hasher';
import { UserRole } from '../../domain/auth/user-role';
import { ApiKeyRepository } from '../../repositories/api-key/api-key.repository';
import { FORBIDDEN_ROLE_MESSAGE } from '../../shared/errors/messages';
import { ApiKeyGuard } from './api-key.guard';

/**
 * Guard de ruta para operaciones de admin (spec 008, US3).
 *
 * Resuelve la ApiKey igual que `ApiKeyGuard` (401 si falta, es inválida o está
 * revocada) y luego exige que el rol copiado en la propia clave sea `admin`
 * (403 si no). El rol se lee de la ApiKey: no se consulta al Usuario en cada request.
 *
 * NO se aplica a ningún endpoint en esta feature (spec, Assumptions). El constructor
 * se declara explícito para que los `@Inject` de los puertos se resuelvan aquí, sin
 * depender de la herencia de metadata de constructor.
 */
@Injectable()
export class AdminApiKeyGuard extends ApiKeyGuard {
  constructor(
    @Inject(TOKEN_HASHER) hasher: TokenHasher,
    @Inject(API_KEY_REPOSITORY) apiKeys: ApiKeyRepository,
  ) {
    super(hasher, apiKeys);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const apiKey = await this.resolveActiveApiKey(context);

    if (apiKey.role !== UserRole.ADMIN) {
      throw new ForbiddenException(FORBIDDEN_ROLE_MESSAGE);
    }

    return true;
  }
}

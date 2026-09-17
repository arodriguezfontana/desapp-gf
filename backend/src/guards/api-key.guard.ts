import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { API_KEY_HEADER, API_KEY_REPOSITORY, TOKEN_HASHER } from '../api-key.constants';
import { TokenHasher } from '../adapters/token-hasher';
import { ApiKeyRepository } from '../repositories/api-key.repository';

/**
 * Guard de ruta (NO global — research.md §1 de 004-player-catalog): exige una
 * ApiKey activa en el header `x-api-key`. Se aplica sólo sobre los controllers
 * que la necesitan (p. ej. `PlayerController`), marcados además `@Public()` para
 * eximirlos del `JwtAuthGuard` global — un JWT válido nunca alcanza acá.
 *
 * No reusa `RawApiKey.of()` para validar el formato: eso lanzaría
 * `InvalidApiKeyFormatError` (400), y esta feature exige 401 para *cualquier*
 * ApiKey inválida, formato incluido. Un string sin el formato esperado
 * simplemente no matchea ningún hash guardado (research.md §3).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_HASHER) private readonly hasher: TokenHasher,
    @Inject(API_KEY_REPOSITORY) private readonly apiKeys: ApiKeyRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawKey = request.headers[API_KEY_HEADER];

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('No autenticado.');
    }

    const keyHash = this.hasher.hash(rawKey);
    const apiKey = await this.apiKeys.findByHash(keyHash);

    if (!apiKey || !apiKey.isActive()) {
      throw new UnauthorizedException('No autenticado.');
    }

    return true;
  }
}

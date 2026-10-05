import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { API_KEY_REPOSITORY, TOKEN_HASHER } from '../../modules/api-key/api-key.constants';
import { TokenHasher } from '../../adapters/api-key/token-hasher';
import { ApiKey } from '../../domain/api-key/api-key';
import { generateRawApiKey } from '../../domain/api-key/raw-api-key';
import { User } from '../../domain/auth/user';
import { ApiKeyRepository } from '../../repositories/api-key/api-key.repository';

export interface IssuedApiKey {
  apiKey: ApiKey;
  rawApiKey: string;
}

@Injectable()
export class ApiKeyService {
  constructor(
    @Inject(API_KEY_REPOSITORY) private readonly apiKeys: ApiKeyRepository,
    @Inject(TOKEN_HASHER) private readonly hasher: TokenHasher,
  ) {}

  /**
   * Emite una ApiKey nueva para el usuario. Si ya tenía una activa, la revoca
   * y persiste ambos cambios atómicamente (spec FR-007, FR-008, FR-011).
   *
   * La clave copia `user.role` en este mismo paso (spec 008, FR-009): el rol se
   * fija al emitir y no cambia después, aunque el usuario cambie de rol.
   */
  async issueApiKey(user: User): Promise<IssuedApiKey> {
    const rawApiKey = generateRawApiKey();
    const keyHash = this.hasher.hash(rawApiKey);
    const newKey = ApiKey.issue(randomUUID(), user.id, keyHash, new Date(), user.role);

    const previousKey = await this.apiKeys.findActiveByUserId(user.id);
    if (previousKey) {
      previousKey.revoke(new Date());
      await this.apiKeys.saveWithRevocation(newKey, previousKey);
    } else {
      await this.apiKeys.save(newKey);
    }

    return { apiKey: newKey, rawApiKey };
  }
}

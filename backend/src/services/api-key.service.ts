import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { API_KEY_REPOSITORY, TOKEN_HASHER } from '../api-key.constants';
import { TokenHasher } from '../adapters/token-hasher';
import { ApiKey } from '../domain/api-key/api-key';
import { RawApiKey } from '../domain/api-key/raw-api-key';
import { ApiKeyRepository } from '../repositories/api-key.repository';

export interface IssuedApiKey {
  apiKey: ApiKey;
  rawApiKey: RawApiKey;
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
   */
  async issueApiKey(userId: string): Promise<IssuedApiKey> {
    const rawApiKey = RawApiKey.generate();
    const keyHash = this.hasher.hash(rawApiKey.toPlainText());
    const newKey = ApiKey.issue(randomUUID(), userId, keyHash, new Date());

    const previousKey = await this.apiKeys.findActiveByUserId(userId);
    if (previousKey) {
      previousKey.revoke(new Date());
      await this.apiKeys.saveWithRevocation(newKey, previousKey);
    } else {
      await this.apiKeys.save(newKey);
    }

    return { apiKey: newKey, rawApiKey };
  }
}

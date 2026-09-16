import { ApiKey } from '../domain/api-key/api-key';

/**
 * Puerto de dominio para la persistencia de ApiKeys. Recibe y devuelve objetos
 * de dominio; el Service nunca ve la entidad de TypeORM. Token: API_KEY_REPOSITORY.
 */
export interface ApiKeyRepository {
  findActiveByUserId(userId: string): Promise<ApiKey | null>;
  findByHash(keyHash: string): Promise<ApiKey | null>;
  save(apiKey: ApiKey): Promise<void>;
  /**
   * Persiste la nueva clave y, si se provee, la revocación de la anterior,
   * dentro de una única transacción atómica (spec FR-011).
   */
  saveWithRevocation(newKey: ApiKey, previousKey?: ApiKey): Promise<void>;
}

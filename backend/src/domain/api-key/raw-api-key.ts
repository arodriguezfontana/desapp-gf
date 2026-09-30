import { randomBytes } from 'node:crypto';
import { API_KEY_PREFIX, API_KEY_RANDOM_BYTES } from '../../modules/api-key/api-key.constants';

/**
 * Genera el valor en texto plano de una ApiKey nueva. Existe solo de forma
 * transitoria durante la emisión (constitución, Principio IV): nunca se persiste.
 */
export function generateRawApiKey(): string {
  const entropy = randomBytes(API_KEY_RANDOM_BYTES).toString('hex');
  return `${API_KEY_PREFIX}${entropy}`;
}

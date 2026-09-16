import { randomBytes } from 'node:crypto';
import { API_KEY_PREFIX, API_KEY_RANDOM_BYTES } from '../api-key.constants';
import { InvalidApiKeyFormatError } from './errors/invalid-api-key-format.error';

const API_KEY_REGEX = /^pmk_[0-9a-f]{64}$/;

/**
 * Value object de la ApiKey en texto plano. Existe solo de forma transitoria
 * durante la emisión (constitución, Principio IV): nunca se persiste.
 */
export class RawApiKey {
  private constructor(private readonly plain: string) {}

  static generate(): RawApiKey {
    const entropy = randomBytes(API_KEY_RANDOM_BYTES).toString('hex');
    return new RawApiKey(`${API_KEY_PREFIX}${entropy}`);
  }

  /** @throws InvalidApiKeyFormatError si el valor no cumple `pmk_` + 64 hex */
  static of(value: string): RawApiKey {
    if (typeof value !== 'string' || !API_KEY_REGEX.test(value)) {
      throw new InvalidApiKeyFormatError();
    }
    return new RawApiKey(value);
  }

  toPlainText(): string {
    return this.plain;
  }
}

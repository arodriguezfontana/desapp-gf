import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordHasher } from './password-hasher';

const COST_FACTOR = 10;

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  /**
   * Se genera en runtime (no como literal) para que no quede en el codigo fuente
   * un string con forma de secreto. La contraseña de origen es publica y no hay
   * ninguna cuenta asociada a este hash.
   */
  readonly timingSafeDummyHash = bcrypt.hashSync(
    'dummy-password-timing-defense',
    COST_FACTOR,
  );

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, COST_FACTOR);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

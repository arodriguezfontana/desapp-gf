import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { TokenHasher } from './token-hasher';

@Injectable()
export class Sha256TokenHasher implements TokenHasher {
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  compare(token: string, expectedHash: string): boolean {
    const computedHash = this.hash(token);
    const computedBuffer = Buffer.from(computedHash, 'hex');
    let expectedBuffer: Buffer;

    try {
      expectedBuffer = Buffer.from(expectedHash, 'hex');
    } catch {
      return false;
    }

    if (computedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(computedBuffer, expectedBuffer);
  }
}


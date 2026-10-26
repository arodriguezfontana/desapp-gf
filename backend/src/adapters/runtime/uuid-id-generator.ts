import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { IdGenerator } from './id-generator';

@Injectable()
export class UuidIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}

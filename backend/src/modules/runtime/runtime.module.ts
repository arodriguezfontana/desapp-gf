import { Module } from '@nestjs/common';
import { SystemClock } from '../../adapters/runtime/system-clock';
import { UuidIdGenerator } from '../../adapters/runtime/uuid-id-generator';
import { CLOCK, ID_GENERATOR } from './runtime.constants';

@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidIdGenerator },
  ],
  exports: [CLOCK, ID_GENERATOR],
})
export class RuntimeModule {}

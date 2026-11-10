import { Module } from '@nestjs/common';
import pino from 'pino';
import { resolveLogLevel } from '../../shared/logging/log-level';
import { LOG_CONFIG, LOG_ROOT_LOGGER, LogConfig } from './logging.constants';

/**
 * Provee la configuración de logging y la instancia raíz de pino. Va en un módulo
 * aparte para que `LoggerModule.forRootAsync` pueda inyectarla y para que los tests
 * sobrescriban `LOG_CONFIG` con un sumidero en memoria.
 */
@Module({
  providers: [
    {
      provide: LOG_CONFIG,
      useFactory: (): LogConfig => ({
        level: resolveLogLevel(process.env.LOG_LEVEL, process.env.NODE_ENV),
      }),
    },
    {
      provide: LOG_ROOT_LOGGER,
      inject: [LOG_CONFIG],
      useFactory: (config: LogConfig) => pino({ level: config.level }, config.stream),
    },
  ],
  exports: [LOG_CONFIG, LOG_ROOT_LOGGER],
})
export class LoggingConfigModule {}

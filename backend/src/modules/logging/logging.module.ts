import { Module } from '@nestjs/common';
import type { Logger } from 'pino';
import { LoggerModule } from 'nestjs-pino';
import { buildRequestLogOptions } from '../../shared/logging/request-log-options';
import { LoggingConfigModule } from './logging-config.module';
import { LOG_ROOT_LOGGER } from './logging.constants';

/**
 * Logging estructurado (spec 028). `LoggerModule` aporta el `Logger` de Nest en JSON y
 * enlaza cada log emitido durante una request a su Correlation ID. La línea de cierre
 * de la request NO la emite este módulo (`autoLogging: false`) sino el middleware que
 * registra `configureRequestLogging`, que corre antes del body parser.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [LoggingConfigModule],
      inject: [LOG_ROOT_LOGGER],
      useFactory: (logger: Logger) => ({
        pinoHttp: { ...buildRequestLogOptions(logger), autoLogging: false },
      }),
    }),
  ],
})
export class LoggingModule {}

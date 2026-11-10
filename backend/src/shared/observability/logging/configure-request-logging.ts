import { INestApplication } from '@nestjs/common';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { LOG_ROOT_LOGGER } from '../../../modules/observability/logging.constants';
import { REQUEST_METRICS_RECORDER } from '../../../modules/observability/metrics.constants';
import type { RequestMetricsRecorder } from '../metrics/request-metrics';
import { buildRequestLogOptions } from './request-log-options';

/**
 * Registra el middleware que loguea cada request y le asigna su Correlation ID.
 *
 * Debe llamarse ANTES de `listen`/`init`: así queda delante del body parser de Nest.
 * Si se registrara sólo vía `LoggerModule`, un JSON mal formado (400) lo rechazaría
 * el parser antes de llegar al middleware: esa request no se loguearía ni devolvería
 * `X-Correlation-Id` (research.md §2 de 028-structured-request-logging).
 */
export function configureRequestLogging(app: INestApplication): void {
  const logger = app.get<Logger>(LOG_ROOT_LOGGER);
  // Las métricas (spec 029) se registran en este mismo hook de cierre; si la app no tiene
  // `MetricsModule` (apps de prueba mínimas) el log funciona igual, sin métricas.
  app.use(pinoHttp(buildRequestLogOptions(logger, resolveRecorder(app))));
}

function resolveRecorder(app: INestApplication): RequestMetricsRecorder | undefined {
  try {
    return app.get<RequestMetricsRecorder>(REQUEST_METRICS_RECORDER, { strict: false });
  } catch {
    return undefined;
  }
}

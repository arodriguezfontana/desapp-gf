import { Module } from '@nestjs/common';
import { MetricsController } from '../../controllers/observability/metrics.controller';
import { BusinessMetricsService } from '../../services/observability/business-metrics.service';
import { MetricsService } from '../../services/observability/metrics.service';
import { BUSINESS_METRICS } from '../../shared/observability/metrics/business-metrics';
import { REQUEST_METRICS_RECORDER } from './metrics.constants';

/**
 * Métricas técnicas de requests (spec 029) y de negocio (spec 031), en el mismo `Registry` y por lo tanto
 * en el mismo `GET /metrics`. El hook de logging de la 028 resuelve el token `REQUEST_METRICS_RECORDER`
 * con `app.get` para registrar cada request al terminar; los services que miden el negocio inyectan
 * `BUSINESS_METRICS` (importando este módulo).
 */
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    BusinessMetricsService,
    { provide: REQUEST_METRICS_RECORDER, useExisting: MetricsService },
    { provide: BUSINESS_METRICS, useExisting: BusinessMetricsService },
  ],
  exports: [MetricsService, REQUEST_METRICS_RECORDER, BusinessMetricsService, BUSINESS_METRICS],
})
export class MetricsModule {}

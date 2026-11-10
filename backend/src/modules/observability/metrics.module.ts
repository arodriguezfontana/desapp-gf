import { Module } from '@nestjs/common';
import { MetricsController } from '../../controllers/observability/metrics.controller';
import { MetricsService } from '../../services/observability/metrics.service';
import { REQUEST_METRICS_RECORDER } from './metrics.constants';

/**
 * Métricas técnicas de requests (spec 029). El hook de logging de la 028 resuelve el token
 * `REQUEST_METRICS_RECORDER` con `app.get` para registrar cada request al terminar.
 */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: REQUEST_METRICS_RECORDER, useExisting: MetricsService }],
  exports: [MetricsService, REQUEST_METRICS_RECORDER],
})
export class MetricsModule {}

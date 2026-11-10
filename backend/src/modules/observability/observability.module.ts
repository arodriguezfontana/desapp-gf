import { Module } from '@nestjs/common';
import { HealthModule } from './health.module';
import { LoggingModule } from './logging.module';
import { MetricsModule } from './metrics.module';

/**
 * Observabilidad del backend (constitución, Principio VII), toda junta: health check (spec 027),
 * logging estructurado con Correlation ID (028) y métricas técnicas con SLA (029). `AppModule` la
 * importa como una sola unidad; los tres submódulos siguen siendo independientes entre sí.
 */
@Module({
  imports: [HealthModule, LoggingModule, MetricsModule],
})
export class ObservabilityModule {}

import { Module } from '@nestjs/common';
import { BusinessAuditModule } from './business-audit.module';
import { HealthModule } from './health.module';
import { InfoModule } from './info.module';
import { LoggingModule } from './logging.module';
import { MetricsModule } from './metrics.module';

/**
 * Observabilidad del backend (constitución, Principio VII), toda junta: health check (spec 027),
 * logging estructurado con Correlation ID (028), auditoría de negocio por AOP (028, US5), métricas
 * técnicas con SLA (029) más las métricas del proceso Node, e información del servicio en `GET /info`
 * (equivalentes a Actuator). `AppModule` la importa como una sola unidad; los submódulos siguen siendo
 * independientes entre sí.
 */
@Module({
  imports: [HealthModule, InfoModule, LoggingModule, MetricsModule, BusinessAuditModule],
})
export class ObservabilityModule {}

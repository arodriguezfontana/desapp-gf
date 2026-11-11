import { Module } from '@nestjs/common';
import { BusinessAuditModule } from './business-audit.module';
import { HealthModule } from './health.module';
import { LoggingModule } from './logging.module';
import { MetricsModule } from './metrics.module';

/**
 * Observabilidad del backend (constitución, Principio VII), toda junta: health check (spec 027),
 * logging estructurado con Correlation ID (028), auditoría de negocio por AOP (028, US5) y métricas
 * técnicas con SLA (029). `AppModule` la importa como una sola unidad; los submódulos siguen siendo
 * independientes entre sí.
 */
@Module({
  imports: [HealthModule, LoggingModule, MetricsModule, BusinessAuditModule],
})
export class ObservabilityModule {}

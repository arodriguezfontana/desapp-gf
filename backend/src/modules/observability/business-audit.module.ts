import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsModule } from './metrics.module';
import { BusinessAuditInterceptor } from '../../shared/observability/business-audit/business-audit.interceptor';

/**
 * Auditoría de negocio transversal (spec 028, User Story 5): registra, con un Interceptor global, qué
 * operación de negocio se ejecutó, quién y con qué resultado. Adicional al logging técnico de requests.
 */
@Module({
  imports: [MetricsModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: BusinessAuditInterceptor }],
})
export class BusinessAuditModule {}

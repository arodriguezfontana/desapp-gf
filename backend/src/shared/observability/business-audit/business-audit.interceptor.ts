import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditRequest, getAuditedOperation, resolveOperation } from './audited-operation.decorator';
import { classifyFailure, resolveActor } from './audit-outcome';
import { RequestValidationException } from './request-validation.exception';

/** Mensaje fijo de toda línea de auditoría de negocio. */
export const BUSINESS_AUDIT_MESSAGE = 'operación de negocio';

/**
 * Auditoría de negocio transversal por AOP (spec 028, User Story 5). Envuelve la ejecución de los
 * handlers declarados con `@AuditedOperation` y registra qué operación de negocio se ejecutó, quién y
 * con qué resultado, sin que el controller ni el service lo invoquen.
 *
 * Es adicional al log técnico de requests (middleware `pino-http`): NO repite método, ruta, parámetros,
 * cuerpo, status ni duración. El Correlation ID entra solo, por el contexto de la request del logger.
 *
 * Un Interceptor sólo ve lo que efectivamente se ejecuta: las requests rechazadas antes (401/403, ruta
 * inexistente, JSON ilegible) nunca llegan acá. Los pipes corren después de los interceptores, así que
 * la validación de DTO se ignora explícitamente (`RequestValidationException`). Siempre relanza el error
 * original, y un fallo al registrar no altera la respuesta (FR-025).
 */
@Injectable()
export class BusinessAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('BusinessAudit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const metadata = getAuditedOperation(context.getHandler());
    if (!metadata) return next.handle();

    const request = context.switchToHttp().getRequest<AuditRequest>();
    return next.handle().pipe(
      tap({
        next: () => this.record(() => ({ outcome: 'success' as const }), metadata, request),
        error: (error: unknown) => {
          // La operación nunca llegó a ejecutarse: la rechazó la validación del pedido.
          if (error instanceof RequestValidationException) return;
          this.record(
            () => ({ outcome: 'failure' as const, failureCategory: classifyFailure(error) }),
            metadata,
            request,
          );
        },
      }),
    );
  }

  private record(
    outcome: () => { outcome: 'success' } | { outcome: 'failure'; failureCategory: 'rejected' | 'unexpected' },
    metadata: NonNullable<ReturnType<typeof getAuditedOperation>>,
    request: AuditRequest,
  ): void {
    try {
      const result = outcome();
      const entry = {
        msg: BUSINESS_AUDIT_MESSAGE,
        event: 'business_audit',
        operation: resolveOperation(metadata, request),
        actor: resolveActor(request, metadata.actor),
        ...result,
      };
      if (result.outcome === 'success') this.logger.log(entry);
      else if (result.failureCategory === 'rejected') this.logger.warn(entry);
      else this.logger.error(entry);
    } catch {
      // Un fallo del registro de auditoría nunca debe alterar el resultado de la operación (FR-025).
    }
  }
}

import { HttpException } from '@nestjs/common';
import { DomainError } from '../../errors/domain-error';
import { AuditActor, AuditRequest } from './audited-operation.decorator';

/** Actor que se registra para una operación de sistema (protegida por API key, sin usuario asociado). */
export const SYSTEM_ACTOR = 'sistema';

/** Actor que se registra cuando no hay usuario autenticado (alta y login). Mismo valor que el log técnico. */
export const ANONYMOUS_ACTOR = 'anónimo';

/** Categoría de un fallo: rechazo por regla de negocio o error inesperado (spec 028, FR-021). */
export type FailureCategory = 'rejected' | 'unexpected';

/**
 * Un `DomainError` o un `HttpException` con status < 500 es un rechazo por regla de negocio o por
 * pedido inválido; cualquier otra cosa (un `Error` común, un 5xx, un valor que no es un `Error`) es un
 * error inesperado.
 */
export function classifyFailure(error: unknown): FailureCategory {
  if (error instanceof DomainError) return 'rejected';
  if (error instanceof HttpException && error.getStatus() < 500) return 'rejected';
  return 'unexpected';
}

/**
 * Actor de la operación: el identificador interno del usuario autenticado si existe; si no, `sistema`
 * para una operación declarada como de sistema y `anónimo` en cualquier otro caso. Nunca mira headers:
 * el valor de una API key no se lee ni se registra (spec 028, FR-022).
 */
export function resolveActor(req: AuditRequest, declared: AuditActor = 'user'): string {
  const userId = req.user?.userId;
  if (userId) return userId;
  return declared === 'system' ? SYSTEM_ACTOR : ANONYMOUS_ACTOR;
}

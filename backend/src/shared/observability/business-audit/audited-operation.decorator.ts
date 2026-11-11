import { SetMetadata } from '@nestjs/common';
import 'reflect-metadata';

/**
 * Auditoría de negocio por AOP (spec 028, User Story 5). `@AuditedOperation` declara, junto al handler
 * de un controller, qué operación de negocio representa; el `BusinessAuditInterceptor` la registra de
 * forma transversal. Sólo agrega metadatos: no cambia el comportamiento del handler.
 */

/** Quién se registra como actor cuando la request no trae un usuario autenticado. */
export type AuditActor = 'user' | 'system' | 'anonymous';

/** Lo mínimo de la request que necesita una operación declarada como función (p. ej. `body.side`). */
export interface AuditRequest {
  body?: unknown;
  user?: { userId?: string };
}

/** Operación que depende del contenido de la request (compra o venta sobre el mismo `POST /orders`). */
export type OperationResolver = (req: AuditRequest) => string;

export interface AuditedOperationMetadata {
  operation: string | OperationResolver;
  actor: AuditActor;
}

/** Clave de los metadatos donde `@AuditedOperation` guarda la declaración del handler. */
export const AUDITED_OPERATION_KEY = 'observability:audited-operation';

export const AuditedOperation = (
  operation: string | OperationResolver,
  options?: { actor?: AuditActor },
) =>
  SetMetadata<string, AuditedOperationMetadata>(AUDITED_OPERATION_KEY, {
    operation,
    actor: options?.actor ?? 'user',
  });

/** Declaración de auditoría de un handler, o `undefined` si no la tiene. */
export function getAuditedOperation(handler: object): AuditedOperationMetadata | undefined {
  return Reflect.getMetadata(AUDITED_OPERATION_KEY, handler) as AuditedOperationMetadata | undefined;
}

/** Nombre semántico de la operación: el literal declarado o el que resuelve la función contra la request. */
export function resolveOperation(metadata: AuditedOperationMetadata, req: AuditRequest): string {
  return typeof metadata.operation === 'function' ? metadata.operation(req) : metadata.operation;
}

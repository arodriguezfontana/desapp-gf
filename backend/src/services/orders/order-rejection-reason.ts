import { InsufficientHoldingError } from '../../domain/portfolio/errors/insufficient-holding.error';
import { RejectionReason } from '../../shared/observability/metrics/business-metrics';

/**
 * Motivo de rechazo de una orden para las métricas de negocio (spec 031). Cada error de dominio conocido
 * se mapea a un motivo del conjunto cerrado; cualquier otro cae en `other`, para que un error nuevo no
 * cree series nuevas.
 *
 * Hoy sólo `InsufficientHoldingError` tiene motivo propio: el sistema no maneja saldo monetario
 * (`insufficient_balance`) ni tiene un error de "tokens no disponibles" (`tokens_unavailable`). Esos
 * valores existen en el conjunto cerrado pero ningún error los produce todavía.
 */
export function rejectionReasonOf(error: unknown): RejectionReason {
  if (error instanceof InsufficientHoldingError) return 'insufficient_tokens';
  return 'other';
}

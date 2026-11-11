import { randomUUID } from 'node:crypto';

export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/** Largo máximo de un Correlation ID entrante aceptado (FR-007). */
export const MAX_CORRELATION_ID_LENGTH = 64;

/** Caracteres seguros: sin espacios, comillas, saltos de línea ni caracteres de control. */
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

/**
 * Decide el Correlation ID de una request: reutiliza el entrante si es válido (así un
 * reintento o una cadena de llamadas relacionadas se rastrea como una sola unidad) y
 * genera uno propio si falta o es dudoso. El valor entrante lo controla quien llama,
 * por eso se valida antes de usarlo: un id enorme o con caracteres de formato podría
 * ensuciar los logs o simular otras entradas (spec 028, "Decisión de diseño").
 */
export function resolveCorrelationId(
  incoming: string | string[] | undefined,
  generate: () => string = randomUUID,
): string {
  if (
    typeof incoming === 'string' &&
    incoming.length > 0 &&
    incoming.length <= MAX_CORRELATION_ID_LENGTH &&
    CORRELATION_ID_PATTERN.test(incoming)
  ) {
    return incoming;
  }
  return generate();
}

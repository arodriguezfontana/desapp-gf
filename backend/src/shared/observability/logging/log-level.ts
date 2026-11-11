const PINO_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];

/**
 * Nivel de logs. Gana `LOG_LEVEL` si es un nivel válido de pino; si falta o es
 * inválido se usa el default del entorno: `debug` en development, `silent` en
 * test (no inundar la salida de la suite) e `info` en cualquier otro caso.
 */
export function resolveLogLevel(
  logLevel: string | undefined,
  nodeEnv: string | undefined,
): string {
  const requested = logLevel?.trim().toLowerCase();
  if (requested && PINO_LEVELS.includes(requested)) {
    return requested;
  }
  if (nodeEnv === 'development') return 'debug';
  if (nodeEnv === 'test') return 'silent';
  return 'info';
}

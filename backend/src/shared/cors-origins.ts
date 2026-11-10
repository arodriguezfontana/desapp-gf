/** Origen del frontend en desarrollo local (Vite). */
export const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

/**
 * Orígenes permitidos por CORS a partir de `CORS_ORIGIN`: una lista separada por
 * comas (por ejemplo, el frontend desplegado y el de desarrollo). Sin valor, o
 * con uno vacío, queda el origen de desarrollo local.
 */
export function parseCorsOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : [DEFAULT_CORS_ORIGIN];
}

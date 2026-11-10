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

/**
 * Opciones de CORS del backend. Expone `X-Correlation-Id` para que el frontend pueda
 * leerlo con `response.headers.get(...)`: sin esto el navegador oculta el header a los
 * scripts de otro origen (spec 028).
 */
export function createCorsOptions(rawOrigins: string | undefined) {
  return {
    origin: parseCorsOrigins(rawOrigins),
    credentials: true,
    exposedHeaders: ['X-Correlation-Id'],
  };
}

import type { IncomingMessage, ServerResponse } from 'node:http';

/** Valor fijo de la etiqueta `route` para toda request que no resuelve a un endpoint (404, 400 del parser, OPTIONS de CORS). */
export const UNMATCHED_ROUTE = 'unmatched';

/** Valor fijo de la etiqueta `method` para cualquier método fuera del conjunto estándar (acota la cardinalidad). */
export const OTHER_METHOD = 'OTHER';

const STANDARD_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

/**
 * Límites (en segundos) del histograma de duración. Incluyen exactamente cada umbral de
 * latencia de `sla.ts` (0,1 / 0,25 / 0,3 / 0,5 / 0,6 / 0,8 / 1 s) para que "p95 ≤ objetivo"
 * se verifique sin interpolar (spec 029, FR-016).
 */
export const DURATION_BUCKETS_SECONDS: readonly number[] = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 0.6, 0.8, 1, 2.5, 5, 10,
];

/** Una request terminada, lista para registrarse. `durationSeconds` es `null` en los streams. */
export interface RequestMetricSample {
  method: string;
  route: string;
  statusCode: number;
  durationSeconds: number | null;
}

/** Destino de las muestras. Lo implementa `MetricsService`; el hook de logging sólo conoce esta interfaz. */
export interface RequestMetricsRecorder {
  record(sample: RequestMetricSample): void;
}

/** Método HTTP acotado a un conjunto cerrado; cualquier otro valor se agrupa bajo `OTHER`. */
export function normalizeMethod(method: string | undefined): string {
  const upper = (method ?? '').toUpperCase();
  return STANDARD_METHODS.has(upper) ? upper : OTHER_METHOD;
}

/**
 * Etiqueta de ruta: el patrón registrado por Express (`/players/:id`), nunca el path pedido.
 * Sin ruta resuelta, o con un comodín (las capas `{/*splat}` de los middleware de Nest), `unmatched`.
 */
export function resolveRouteLabel(req: IncomingMessage): string {
  const path = (req as { route?: { path?: unknown } }).route?.path;
  if (typeof path !== 'string' || path.includes('*')) return UNMATCHED_ROUTE;
  return path;
}

/** Las conexiones de stream (SSE) duran lo que la conexión: no deben distorsionar la latencia. */
export function isStreamResponse(res: ServerResponse): boolean {
  const contentType = res.getHeader('content-type');
  return typeof contentType === 'string' && contentType.toLowerCase().startsWith('text/event-stream');
}

/** Arma la muestra de una request terminada con los mismos valores que usa el log (`responseTime` en ms). */
export function toMetricSample(
  req: IncomingMessage,
  res: ServerResponse,
  responseTimeMs: number,
): RequestMetricSample {
  return {
    method: normalizeMethod(req.method),
    route: resolveRouteLabel(req),
    statusCode: res.statusCode,
    durationSeconds: isStreamResponse(res) ? null : responseTimeMs / 1000,
  };
}

import 'reflect-metadata';
import { SetMetadata } from '@nestjs/common';

/**
 * SLA objetivo por endpoint (spec 029): latencia p95 y tasa máxima de respuestas 5xx.
 *
 * Cada handler de controller se declara con `@Sla('<clase>')`; las clases y sus umbrales viven
 * acá, en un solo lugar. La tabla "SLA por endpoint" de `specs/029-http-metrics-sla/spec.md` es la
 * referencia legible; ESTE archivo y los decorators son la fuente verificable: el e2e
 * `sla-coverage` falla si un endpoint publicado no tiene SLA (o al revés) y comprueba que cada
 * umbral de latencia es un límite del histograma de `request-metrics.ts`.
 *
 * Son objetivos declarados, no derivados de tráfico real. La tasa de error cuenta sólo 5xx.
 */
export type SlaClassName =
  | 'auth'
  | 'read'
  | 'read-computed'
  | 'write'
  | 'market'
  | 'system-trigger'
  | 'system-status'
  | 'system-long'
  | 'stream'
  | 'ping'
  | 'technical';

export interface SlaClass {
  /** Objetivo de latencia p95 en milisegundos; `null` si no aplica (larga duración o conexión abierta). */
  p95Ms: number | null;
  /** Proporción máxima de respuestas 5xx sobre el total de requests del endpoint (0,005 = 0,5 %). */
  maxErrorRate: number;
}

export const SLA_CLASSES: Record<SlaClassName, SlaClass> = {
  // Alta, login y API key: incluyen hashing de contraseña.
  auth: { p95Ms: 600, maxErrorRate: 0.005 },
  // Lecturas simples.
  read: { p95Ms: 300, maxErrorRate: 0.005 },
  // Lecturas con cálculo (ranking, valuación).
  'read-computed': { p95Ms: 800, maxErrorRate: 0.005 },
  // Escrituras simples.
  write: { p95Ms: 500, maxErrorRate: 0.005 },
  // Órdenes de mercado, con cruce.
  market: { p95Ms: 800, maxErrorRate: 0.005 },
  // Disparos de sincronización con terceros.
  'system-trigger': { p95Ms: 1000, maxErrorRate: 0.01 },
  // Consulta del estado de una sincronización.
  'system-status': { p95Ms: 300, maxErrorRate: 0.01 },
  // Operaciones de larga duración: su duración depende del trabajo, no hay objetivo de latencia.
  'system-long': { p95Ms: null, maxErrorRate: 0.01 },
  // Conexión abierta (SSE): se cuenta pero no entra al histograma de latencia.
  stream: { p95Ms: null, maxErrorRate: 0.005 },
  // Raíz del servicio.
  ping: { p95Ms: 100, maxErrorRate: 0.005 },
  // Endpoints técnicos: /health y /metrics.
  technical: { p95Ms: 250, maxErrorRate: 0.005 },
};

/** Clave de los metadatos donde `@Sla` guarda la clase del handler. */
export const SLA_METADATA_KEY = 'metrics:sla';

/** Declara la clase de SLA de un handler de controller. Sólo agrega metadatos: no cambia el comportamiento. */
export const Sla = (name: SlaClassName) => SetMetadata(SLA_METADATA_KEY, name);

/** Clase de SLA declarada en un handler, o `undefined` si no tiene `@Sla`. */
export function getSlaClass(handler: object): SlaClassName | undefined {
  return Reflect.getMetadata(SLA_METADATA_KEY, handler) as SlaClassName | undefined;
}

/** Umbrales de latencia declarados, en segundos y sin repetir (para compararlos con los límites del histograma). */
export function slaLatencyThresholdsSeconds(): number[] {
  const thresholds = Object.values(SLA_CLASSES)
    .map((sla) => sla.p95Ms)
    .filter((ms): ms is number => ms !== null)
    .map((ms) => ms / 1000);
  return [...new Set(thresholds)].sort((a, b) => a - b);
}

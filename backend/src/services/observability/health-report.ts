export type ComponentState = 'up' | 'down';

/** Estado individual de una dependencia verificada por el health check. */
export interface ComponentStatus {
  status: ComponentState;
  /** Sólo cuando el componente está caído por timeout. Nunca incluye el error original ni datos de conexión. */
  message?: string;
}

/** Mapa componente -> estado (hoy el único componente es `database`). */
export type ComponentStatusMap = Record<string, ComponentStatus>;

/**
 * Informe de salud que devuelve `HealthService` (spec 027). Es el resultado de la capa de Service; el
 * Controller lo expone con `HealthResponseDto`, que lo implementa. El Service no importa el DTO.
 */
export interface HealthReport {
  status: 'ok' | 'error' | 'shutting_down';
  /** Componentes en estado `up`. */
  info: ComponentStatusMap;
  /** Componentes en estado `down`. */
  error: ComponentStatusMap;
  /** Todos los componentes verificados, con su estado individual. */
  details: ComponentStatusMap;
}

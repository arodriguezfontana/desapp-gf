import { Position } from './position';

/** Las 4 métricas de rendimiento, promedio por partido de la temporada en curso. */
export interface PlayerMetrics {
  passesCompleted: number;
  shots: number;
  interceptions: number;
  rating: number;
}

/**
 * Forma que `PlayerSyncService` le entrega al repositorio para upsertear un
 * jugador dentro de un equipo (FR-016). `position` ya viene mapeada al enum
 * propio (nunca el código crudo de WhoScored) — no-opcional a propósito: un
 * jugador sin posición mapeable no llega a convertirse en un `PlayerSyncInput`,
 * queda excluido antes (FR-012).
 */
export interface PlayerSyncInput {
  externalId: string;
  name: string;
  position: Position;
  /** `null` si no hay valor disponible (FR-007, FR-018). */
  metrics: PlayerMetrics | null;
}

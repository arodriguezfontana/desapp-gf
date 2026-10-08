import { Player } from '../player/player';
import { ValuationStrategy } from './valuation-strategy';

/**
 * Bounds máximos realistas de temporada para jugadores de élite.
 * Constante exportada para que los tests la usen directamente y para que
 * ValuationStrategy pueda validar las claves de sus pesos (012-valuation-strategies,
 * data-model.md §NormalizationBounds, spec DD-002).
 */
export const NORMALIZATION_BOUNDS: Readonly<Record<string, number>> = {
  goals: 40,
  assists: 25,
  keyPasses: 150,
  dribbles: 200,
  totalTackles: 150,
  shots: 200,
  passesCompleted: 2500,
  interceptions: 100,
  rating: 10,
  yellowCards: 15,
  redCards: 5,
} as const;

/** Obtiene el valor bruto de una métrica del jugador dado su nombre de campo. */
function getMetric(player: Player, key: string): number | null {
  const map: Record<string, number | null> = {
    goals: player.goals,
    assists: player.assists,
    keyPasses: player.keyPasses,
    dribbles: player.dribbles,
    totalTackles: player.totalTackles,
    shots: player.shots,
    passesCompleted: player.passesCompleted,
    interceptions: player.interceptions,
    rating: player.rating,
    yellowCards: player.yellowCards,
    redCards: player.redCards,
  };
  return map[key] ?? null;
}

/**
 * Calcula el score y el valor de un jugador según una estrategia de valuación.
 *
 * Función de dominio pura: sin acceso a base de datos ni dependencias de NestJS
 * (012-valuation-strategies, spec FR-008, constitución Principio I).
 *
 * Algoritmo:
 *   normalizada_i = clamp(metrica_i ?? 0, 0, bound_i) / bound_i
 *   score = Σ(peso_i × normalizada_i)
 *   value = 1 + (score × factorEscala)
 *
 * El value puede ser negativo si el score es muy negativo (pesos negativos en
 * métricas disciplinarias). Se persiste sin clamp — riesgo aceptado (spec FR-010).
 */
export function calculatePlayerValue(
  player: Player,
  strategy: ValuationStrategy,
): { score: number; value: number } {
  let score = 0;

  for (const [metricKey, weight] of Object.entries(strategy.weights)) {
    const bound = NORMALIZATION_BOUNDS[metricKey];
    if (bound === undefined) continue;

    const raw = getMetric(player, metricKey) ?? 0;
    const clamped = Math.max(0, Math.min(raw, bound));
    const normalized = clamped / bound;
    score += weight * normalized;
  }

  const value = 1 + score * strategy.factorEscala;
  return { score, value };
}

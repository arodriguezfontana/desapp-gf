import { Player } from '../player/player';
import { Position } from '../player/enums/position';
import { ValuationStrategy } from './valuation-strategy';

/**
 * Bounds máximos realistas para jugadores de élite (012-valuation-strategies,
 * data-model.md §NormalizationBounds, spec DD-002). Constante exportada para
 * que los tests la usen directamente y para que ValuationStrategy pueda
 * validar las claves de sus pesos.
 *
 * `goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles`, `yellowCards` y
 * `redCards` son ACUMULADOS de temporada (ver player.entity.ts): el bound es
 * un techo de temporada completa.
 *
 * `passesCompleted`, `shots`, `interceptions` y `rating` son PROMEDIO POR
 * PARTIDO de la temporada en curso (mismo comentario en player.entity.ts), así
 * que su bound tiene que ser un techo de promedio por partido, no de
 * temporada — usar un bound de temporada ahí (p. ej. 2500 para
 * passesCompleted) dejaba la métrica casi siempre normalizada a ~0, sin peso
 * real en el score.
 */
export const NORMALIZATION_BOUNDS: Readonly<Record<string, number>> = {
  goals: 40,
  assists: 25,
  keyPasses: 150,
  dribbles: 200,
  totalTackles: 150,
  shots: 6,
  passesCompleted: 100,
  interceptions: 4,
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
 * Si la estrategia define un perfil de pesos para la posición declarada del
 * jugador, se usa ese perfil; si no, se usan los pesos generales de la
 * estrategia, igual que antes de 014-position-weight-profiles (spec FR-004,
 * FR-005). `appliedPosition` y `weightsUsed` informan cuál de los dos casos
 * ocurrió, para que el caller pueda registrar el snapshot correcto en
 * `PlayerQuote` (spec FR-009).
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
): {
  score: number;
  value: number;
  appliedPosition: Position | null;
  weightsUsed: Record<string, number>;
} {
  const profile = strategy.positionWeights[player.position];
  const weightsUsed = profile ?? strategy.weights;
  const appliedPosition = profile ? player.position : null;

  let score = 0;

  for (const [metricKey, weight] of Object.entries(weightsUsed)) {
    const bound = NORMALIZATION_BOUNDS[metricKey];
    if (bound === undefined) continue;

    const raw = getMetric(player, metricKey) ?? 0;
    const clamped = Math.max(0, Math.min(raw, bound));
    const normalized = clamped / bound;
    score += weight * normalized;
  }

  const value = 1 + score * strategy.factorEscala;
  return { score, value, appliedPosition, weightsUsed };
}

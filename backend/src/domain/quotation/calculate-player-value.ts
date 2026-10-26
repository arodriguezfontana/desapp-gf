import { Player } from '../player/player';
import { PlayerValuation } from './player-valuator';
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

/** Valor mínimo de un jugador: el score no puede llevar el precio por debajo de este piso (spec 027). */
export const MIN_PLAYER_VALUE = 1;

/** Obtiene el valor bruto de una métrica del jugador dado su nombre de campo. */
export function getMetric(player: Player, key: string): number | null {
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

/** Lleva `raw` al rango [0,1] recortándolo entre 0 y `bound`. Un valor `null` cuenta como 0. */
export function clampAndNormalize(raw: number | null, bound: number): number {
  const clamped = Math.max(0, Math.min(raw ?? 0, bound));
  return clamped / bound;
}

/**
 * Cómo se normaliza UNA métrica de UN jugador a [0,1]. Es lo único que cambia
 * entre los métodos de valuación (`PlayerValuator`).
 */
export type MetricNormalizer = (player: Player, metricKey: string, bound: number) => number;

/** Normalización de temporada: el valor bruto contra el techo de `NORMALIZATION_BOUNDS`. */
export const normalizeBySeason: MetricNormalizer = (player, metricKey, bound) =>
  clampAndNormalize(getMetric(player, metricKey), bound);

/**
 * Calcula el score y el valor de un jugador según una estrategia de valuación,
 * con el normalizador de métricas que se le indique.
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
 *   normalizada_i = normalizador(jugador, metrica_i)   // en [0,1]
 *   score = Σ(peso_i × normalizada_i)
 *   value = max(MIN_PLAYER_VALUE, 1 + (score × factorEscala))
 *
 * El score puede ser negativo (pesos negativos en métricas disciplinarias), pero
 * el value nunca baja de `MIN_PLAYER_VALUE` (spec 027, reemplaza el riesgo
 * aceptado de 012 FR-010: un precio negativo no tiene sentido en el mercado).
 */
export function valuateWithNormalizer(
  player: Player,
  strategy: ValuationStrategy,
  normalize: MetricNormalizer,
): PlayerValuation {
  const profile = strategy.positionWeights[player.position];
  const weightsUsed = profile ?? strategy.weights;
  const appliedPosition = profile ? player.position : null;

  let score = 0;

  for (const [metricKey, weight] of Object.entries(weightsUsed)) {
    const bound = NORMALIZATION_BOUNDS[metricKey];
    if (bound === undefined) continue;

    score += weight * normalize(player, metricKey, bound);
  }

  const value = Math.max(MIN_PLAYER_VALUE, 1 + score * strategy.factorEscala);
  return { score, value, appliedPosition, weightsUsed };
}

/** Valuación con normalización de temporada (método `WEIGHTED`, el original de 012). */
export function calculatePlayerValue(player: Player, strategy: ValuationStrategy): PlayerValuation {
  return valuateWithNormalizer(player, strategy, normalizeBySeason);
}

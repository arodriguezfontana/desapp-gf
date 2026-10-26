import { Player } from '../player/player';
import {
  clampAndNormalize,
  getMetric,
  MetricNormalizer,
  normalizeBySeason,
  valuateWithNormalizer,
} from './calculate-player-value';
import { PlayerValuation, PlayerValuator } from './player-valuator';
import { ValuationMethod } from './valuation-method';
import { ValuationStrategy } from './valuation-strategy';

/** Cantidad de partidos de una temporada de liga completa, usada para pasar un techo de temporada a techo por partido. */
export const SEASON_MATCHES = 38;

/**
 * Métricas ACUMULADAS de temporada (ver `NORMALIZATION_BOUNDS`): crecen con los
 * partidos jugados. Las demás ya son promedios por partido.
 */
export const ACCUMULATED_METRICS: ReadonlySet<string> = new Set([
  'goals',
  'assists',
  'keyPasses',
  'dribbles',
  'totalTackles',
  'yellowCards',
  'redCards',
]);

/**
 * Normaliza las métricas acumuladas por partido jugado: el valor bruto se divide
 * por `matchesPlayed` y se compara contra el techo de temporada repartido en
 * `SEASON_MATCHES` partidos. Así un jugador que jugó pocos partidos no queda
 * penalizado. Sin `matchesPlayed` (null o 0) no hay forma de repartir, y se cae a
 * la normalización de temporada.
 */
const normalizePerMatch: MetricNormalizer = (player, metricKey, bound) => {
  const matches = player.matchesPlayed;
  if (!ACCUMULATED_METRICS.has(metricKey) || matches === null || matches <= 0) {
    return normalizeBySeason(player, metricKey, bound);
  }
  const raw = getMetric(player, metricKey);
  const perMatch = raw === null ? null : raw / matches;
  return clampAndNormalize(perMatch, bound / SEASON_MATCHES);
};

/**
 * Valuación por partido (spec 027): igual que `WEIGHTED` salvo que las
 * métricas acumuladas se miden por partido jugado.
 */
export class PerMatchValuator implements PlayerValuator {
  readonly method = ValuationMethod.PER_MATCH;

  valuate(player: Player, strategy: ValuationStrategy): PlayerValuation {
    return valuateWithNormalizer(player, strategy, normalizePerMatch);
  }
}

import { Player } from '../player/player';
import { calculatePlayerValue } from './calculate-player-value';
import { PlayerValuation, PlayerValuator } from './player-valuator';
import { ValuationMethod } from './valuation-method';
import { ValuationStrategy } from './valuation-strategy';

/**
 * Método original de valuación (012-valuation-strategies): cada métrica se
 * normaliza contra su techo de temporada (`NORMALIZATION_BOUNDS`).
 */
export class WeightedMetricsValuator implements PlayerValuator {
  readonly method = ValuationMethod.WEIGHTED;

  valuate(player: Player, strategy: ValuationStrategy): PlayerValuation {
    return calculatePlayerValue(player, strategy);
  }
}

import { PerMatchValuator } from './per-match-valuator';
import { PlayerValuator } from './player-valuator';
import { ValuationMethod } from './valuation-method';
import { WeightedMetricsValuator } from './weighted-metrics-valuator';

const VALUATORS: Readonly<Record<ValuationMethod, PlayerValuator>> = {
  [ValuationMethod.WEIGHTED]: new WeightedMetricsValuator(),
  [ValuationMethod.PER_MATCH]: new PerMatchValuator(),
};

/** Implementación de `PlayerValuator` para un método de valuación (selección en runtime del Strategy pattern). */
export function getPlayerValuator(method: ValuationMethod): PlayerValuator {
  return VALUATORS[method];
}

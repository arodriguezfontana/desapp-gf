import { Player } from '../player/player';
import { Position } from '../player/enums/position';
import { ValuationMethod } from './valuation-method';
import { ValuationStrategy } from './valuation-strategy';

/** Resultado de valuar un jugador con una estrategia. */
export interface PlayerValuation {
  score: number;
  value: number;
  appliedPosition: Position | null;
  weightsUsed: Record<string, number>;
}

/**
 * Interfaz común de los métodos de valuación (Strategy pattern, constitución
 * Principio II). Las implementaciones son intercambiables y se eligen en
 * runtime según el `method` de la `ValuationStrategy` del usuario.
 */
export interface PlayerValuator {
  readonly method: ValuationMethod;
  valuate(player: Player, strategy: ValuationStrategy): PlayerValuation;
}

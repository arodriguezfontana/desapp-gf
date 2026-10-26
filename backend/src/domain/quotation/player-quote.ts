import { Position } from '../player/enums/position';
import { ValuationMethod } from './valuation-method';

/**
 * Cotización calculada de un jugador en un momento dado, generada por el
 * recálculo manual de un usuario puntual (019-per-user-valuation-strategies,
 * spec FR-015: queda asociada de forma inmutable al usuario que la disparó).
 *
 * Registra un snapshot completo de los parámetros de cálculo para garantizar
 * reproducibilidad histórica aunque la estrategia cambie después
 * (012-valuation-strategies, spec DD-001).
 *
 * `appliedPosition` indica si el snapshot corresponde al perfil de una
 * posición (y cuál) o a los pesos generales de la estrategia (`null`)
 * (014-position-weight-profiles, spec FR-009, research.md Decisión 2).
 */
export class PlayerQuote {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _playerId: string,
    private readonly _strategyId: string,
    private readonly _weightSnapshot: Record<string, number>,
    private readonly _factorEscalaSnapshot: number,
    private readonly _score: number,
    private readonly _value: number,
    private readonly _calculatedAt: Date,
    private readonly _appliedPosition: Position | null,
    private readonly _valuationMethod: ValuationMethod,
  ) {}

  static create(props: {
    id: string;
    userId: string;
    playerId: string;
    strategyId: string;
    weightSnapshot: Record<string, number>;
    factorEscalaSnapshot: number;
    score: number;
    value: number;
    calculatedAt: Date;
    appliedPosition?: Position | null;
    valuationMethod?: ValuationMethod;
  }): PlayerQuote {
    return PlayerQuote.restore(props);
  }

  static restore(props: {
    id: string;
    userId: string;
    playerId: string;
    strategyId: string;
    weightSnapshot: Record<string, number>;
    factorEscalaSnapshot: number;
    score: number;
    value: number;
    calculatedAt: Date;
    appliedPosition?: Position | null;
    valuationMethod?: ValuationMethod;
  }): PlayerQuote {
    return new PlayerQuote(
      props.id,
      props.userId,
      props.playerId,
      props.strategyId,
      props.weightSnapshot,
      props.factorEscalaSnapshot,
      props.score,
      props.value,
      props.calculatedAt,
      props.appliedPosition ?? null,
      props.valuationMethod ?? ValuationMethod.WEIGHTED,
    );
  }

  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get playerId(): string { return this._playerId; }
  get strategyId(): string { return this._strategyId; }
  get weightSnapshot(): Record<string, number> { return this._weightSnapshot; }
  get factorEscalaSnapshot(): number { return this._factorEscalaSnapshot; }
  get score(): number { return this._score; }
  get value(): number { return this._value; }
  get calculatedAt(): Date { return this._calculatedAt; }
  get appliedPosition(): Position | null { return this._appliedPosition; }
  /** Método de cálculo con el que se produjo la cotización (parte del snapshot de reproducibilidad, spec 027). */
  get valuationMethod(): ValuationMethod { return this._valuationMethod; }
}

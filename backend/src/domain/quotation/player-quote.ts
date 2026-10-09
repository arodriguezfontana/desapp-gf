/**
 * Cotización calculada de un jugador en un momento dado.
 *
 * Registra un snapshot completo de los parámetros de cálculo para garantizar
 * reproducibilidad histórica aunque la estrategia cambie después
 * (012-valuation-strategies, spec DD-001).
 */
export class PlayerQuote {
  private constructor(
    private readonly _id: string,
    private readonly _playerId: string,
    private readonly _strategyId: string,
    private readonly _weightSnapshot: Record<string, number>,
    private readonly _factorEscalaSnapshot: number,
    private readonly _score: number,
    private readonly _value: number,
    private readonly _calculatedAt: Date,
  ) {}

  static create(props: {
    id: string;
    playerId: string;
    strategyId: string;
    weightSnapshot: Record<string, number>;
    factorEscalaSnapshot: number;
    score: number;
    value: number;
    calculatedAt: Date;
  }): PlayerQuote {
    return new PlayerQuote(
      props.id,
      props.playerId,
      props.strategyId,
      props.weightSnapshot,
      props.factorEscalaSnapshot,
      props.score,
      props.value,
      props.calculatedAt,
    );
  }

  static restore(props: {
    id: string;
    playerId: string;
    strategyId: string;
    weightSnapshot: Record<string, number>;
    factorEscalaSnapshot: number;
    score: number;
    value: number;
    calculatedAt: Date;
  }): PlayerQuote {
    return new PlayerQuote(
      props.id,
      props.playerId,
      props.strategyId,
      props.weightSnapshot,
      props.factorEscalaSnapshot,
      props.score,
      props.value,
      props.calculatedAt,
    );
  }

  get id(): string { return this._id; }
  get playerId(): string { return this._playerId; }
  get strategyId(): string { return this._strategyId; }
  get weightSnapshot(): Record<string, number> { return this._weightSnapshot; }
  get factorEscalaSnapshot(): number { return this._factorEscalaSnapshot; }
  get score(): number { return this._score; }
  get value(): number { return this._value; }
  get calculatedAt(): Date { return this._calculatedAt; }
}

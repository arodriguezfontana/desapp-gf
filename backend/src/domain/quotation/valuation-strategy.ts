import { NORMALIZATION_BOUNDS } from './calculate-player-value';
import { InvalidStrategyWeightsError } from './errors/invalid-strategy-weights.error';

/**
 * Estrategia de valuación de jugadores.
 *
 * Encapsula los pesos por métrica y el factor de escala que determinan cómo se
 * calcula el valor de un jugador. Solo puede haber una activa a la vez
 * (012-valuation-strategies, spec FR-004). Los pesos son decimales; se admiten
 * pesos negativos para métricas disciplinarias; la suma algebraica debe ser
 * 1.0 con tolerancia ±0.001 (spec FR-002, DD-003).
 */
export class ValuationStrategy {
  private constructor(
    private readonly _id: string,
    private readonly _name: string,
    private readonly _weights: Record<string, number>,
    private readonly _factorEscala: number,
    private readonly _isActive: boolean,
  ) {}

  static create(props: {
    id: string;
    name: string;
    weights: Record<string, number>;
    factorEscala: number;
    isActive: boolean;
  }): ValuationStrategy {
    const sum = Object.values(props.weights).reduce((acc, w) => acc + w, 0);
    // 1e-10 accounts for IEEE 754 float representation of the bound itself
    if (Math.abs(sum - 1.0) > 0.001 + 1e-10) {
      throw new InvalidStrategyWeightsError(
        `La suma de los pesos debe ser 1.0 (tolerancia ±0.001). Suma actual: ${sum.toFixed(6)}.`,
      );
    }

    if (props.factorEscala <= 0) {
      throw new InvalidStrategyWeightsError(
        `El factorEscala debe ser un valor positivo. Valor recibido: ${props.factorEscala}.`,
      );
    }

    const validKeys = new Set(Object.keys(NORMALIZATION_BOUNDS));
    for (const key of Object.keys(props.weights)) {
      if (!validKeys.has(key)) {
        throw new InvalidStrategyWeightsError(
          `La métrica '${key}' no es válida. Métricas válidas: ${[...validKeys].join(', ')}.`,
        );
      }
    }

    return new ValuationStrategy(
      props.id,
      props.name,
      props.weights,
      props.factorEscala,
      props.isActive,
    );
  }

  static restore(props: {
    id: string;
    name: string;
    weights: Record<string, number>;
    factorEscala: number;
    isActive: boolean;
  }): ValuationStrategy {
    return new ValuationStrategy(
      props.id,
      props.name,
      props.weights,
      props.factorEscala,
      props.isActive,
    );
  }

  activate(): ValuationStrategy {
    return new ValuationStrategy(this._id, this._name, this._weights, this._factorEscala, true);
  }

  deactivate(): ValuationStrategy {
    return new ValuationStrategy(this._id, this._name, this._weights, this._factorEscala, false);
  }

  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get weights(): Record<string, number> { return { ...this._weights }; }
  get factorEscala(): number { return this._factorEscala; }
  get isActive(): boolean { return this._isActive; }
}

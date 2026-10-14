import { Position } from '../player/enums/position';
import { NORMALIZATION_BOUNDS } from './calculate-player-value';
import { InvalidStrategyWeightsError } from './errors/invalid-strategy-weights.error';

type PositionWeights = Partial<Record<Position, Record<string, number>>>;

/**
 * Valida que un mapa de pesos (generales o de un perfil de posición) sume 1.0
 * con tolerancia ±0.001 y que todas sus claves sean métricas reconocidas
 * (014-position-weight-profiles, spec FR-003, research.md Decisión 4).
 */
function validateWeightsSum(weights: Record<string, number>, label: string): void {
  const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
  // 1e-10 accounts for IEEE 754 float representation of the bound itself
  if (Math.abs(sum - 1.0) > 0.001 + 1e-10) {
    throw new InvalidStrategyWeightsError(
      `La suma de los pesos de ${label} debe ser 1.0 (tolerancia ±0.001). Suma actual: ${sum.toFixed(6)}.`,
    );
  }

  const validKeys = new Set(Object.keys(NORMALIZATION_BOUNDS));
  for (const key of Object.keys(weights)) {
    if (!validKeys.has(key)) {
      throw new InvalidStrategyWeightsError(
        `La métrica '${key}' de ${label} no es válida. Métricas válidas: ${[...validKeys].join(', ')}.`,
      );
    }
  }
}

/**
 * Estrategia de valuación de jugadores.
 *
 * Encapsula los pesos por métrica y el factor de escala que determinan cómo se
 * calcula el valor de un jugador. Solo puede haber una activa a la vez
 * (012-valuation-strategies, spec FR-004). Los pesos son decimales; se admiten
 * pesos negativos para métricas disciplinarias; la suma algebraica debe ser
 * 1.0 con tolerancia ±0.001 (spec FR-002, DD-003).
 *
 * Opcionalmente define, por posición (FW/MF/DF/GK), un perfil de pesos que
 * sustituye a los pesos generales al cotizar un jugador de esa posición
 * (014-position-weight-profiles, spec FR-001/FR-002/FR-003).
 */
export class ValuationStrategy {
  private constructor(
    private readonly _id: string,
    private readonly _name: string,
    private readonly _weights: Record<string, number>,
    private readonly _factorEscala: number,
    private readonly _isActive: boolean,
    private readonly _positionWeights: PositionWeights,
  ) {}

  static create(props: {
    id: string;
    name: string;
    weights: Record<string, number>;
    factorEscala: number;
    isActive: boolean;
    positionWeights?: PositionWeights;
  }): ValuationStrategy {
    validateWeightsSum(props.weights, 'los pesos generales');

    if (props.factorEscala <= 0) {
      throw new InvalidStrategyWeightsError(
        `El factorEscala debe ser un valor positivo. Valor recibido: ${props.factorEscala}.`,
      );
    }

    const positionWeights = props.positionWeights ?? {};
    for (const [position, weights] of Object.entries(positionWeights)) {
      validateWeightsSum(weights, `el perfil de posición '${position}'`);
    }

    return new ValuationStrategy(
      props.id,
      props.name,
      props.weights,
      props.factorEscala,
      props.isActive,
      positionWeights,
    );
  }

  static restore(props: {
    id: string;
    name: string;
    weights: Record<string, number>;
    factorEscala: number;
    isActive: boolean;
    positionWeights?: PositionWeights;
  }): ValuationStrategy {
    return new ValuationStrategy(
      props.id,
      props.name,
      props.weights,
      props.factorEscala,
      props.isActive,
      props.positionWeights ?? {},
    );
  }

  activate(): ValuationStrategy {
    return new ValuationStrategy(
      this._id,
      this._name,
      this._weights,
      this._factorEscala,
      true,
      this._positionWeights,
    );
  }

  deactivate(): ValuationStrategy {
    return new ValuationStrategy(
      this._id,
      this._name,
      this._weights,
      this._factorEscala,
      false,
      this._positionWeights,
    );
  }

  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get weights(): Record<string, number> { return { ...this._weights }; }
  get factorEscala(): number { return this._factorEscala; }
  get isActive(): boolean { return this._isActive; }
  get positionWeights(): PositionWeights { return { ...this._positionWeights }; }
}

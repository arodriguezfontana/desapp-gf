import { League } from '../../player/enums/league';
import { Position } from '../../player/enums/position';
import { Player } from '../../player/player';
import { calculatePlayerValue, MIN_PLAYER_VALUE } from '../calculate-player-value';
import { InvalidValuationMethodError } from '../errors/invalid-valuation-method.error';
import { PerMatchValuator, SEASON_MATCHES } from '../per-match-valuator';
import { PlayerQuote } from '../player-quote';
import { parseValuationMethod, ValuationMethod } from '../valuation-method';
import { ValuationStrategy } from '../valuation-strategy';
import { getPlayerValuator } from '../valuator-registry';
import { WeightedMetricsValuator } from '../weighted-metrics-valuator';

function makeStrategy(
  weights: Record<string, number>,
  method?: ValuationMethod,
  factorEscala = 99,
): ValuationStrategy {
  return ValuationStrategy.restore({
    id: 'strategy-1',
    userId: 'user-1',
    name: 'Test',
    weights,
    factorEscala,
    isSelected: true,
    method,
  });
}

function makePlayer(metrics: {
  matchesPlayed?: number | null;
  goals?: number | null;
  rating?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
}): Player {
  return Player.restore({
    id: 'player-1',
    name: 'Test Player',
    league: League.PREMIER_LEAGUE,
    team: 'Test FC',
    position: Position.FW,
    matchesPlayed: metrics.matchesPlayed ?? null,
    passesCompleted: null,
    shots: null,
    interceptions: null,
    rating: metrics.rating ?? null,
    goals: metrics.goals ?? null,
    yellowCards: metrics.yellowCards ?? null,
    redCards: metrics.redCards ?? null,
  });
}

describe('parseValuationMethod', () => {
  it.each([ValuationMethod.WEIGHTED, ValuationMethod.PER_MATCH])('acepta %s', (method) => {
    expect(parseValuationMethod(method)).toBe(method);
  });

  it('rechaza un método desconocido con un error de dominio', () => {
    expect(() => parseValuationMethod('RANDOM')).toThrow(InvalidValuationMethodError);
  });
});

describe('getPlayerValuator', () => {
  it('devuelve la implementación que corresponde a cada método', () => {
    expect(getPlayerValuator(ValuationMethod.WEIGHTED)).toBeInstanceOf(WeightedMetricsValuator);
    expect(getPlayerValuator(ValuationMethod.PER_MATCH)).toBeInstanceOf(PerMatchValuator);
  });

  it('cada implementación declara su propio método', () => {
    expect(getPlayerValuator(ValuationMethod.WEIGHTED).method).toBe(ValuationMethod.WEIGHTED);
    expect(getPlayerValuator(ValuationMethod.PER_MATCH).method).toBe(ValuationMethod.PER_MATCH);
  });
});

describe('WeightedMetricsValuator', () => {
  it('devuelve el mismo resultado que calculatePlayerValue', () => {
    const strategy = makeStrategy({ goals: 0.5, rating: 0.5 });
    const player = makePlayer({ goals: 20, rating: 7.5, matchesPlayed: 10 });

    expect(new WeightedMetricsValuator().valuate(player, strategy)).toEqual(calculatePlayerValue(player, strategy));
  });
});

describe('PerMatchValuator', () => {
  const valuator = new PerMatchValuator();
  const goalsOnly = makeStrategy({ goals: 1 }, ValuationMethod.PER_MATCH);

  it('mide las métricas acumuladas por partido jugado', () => {
    // 10 goles en 10 partidos = 1 por partido; el techo por partido es 40 / 38.
    const { score, value } = valuator.valuate(makePlayer({ goals: 10, matchesPlayed: 10 }), goalsOnly);

    expect(score).toBeCloseTo(SEASON_MATCHES / 40, 6);
    expect(value).toBeCloseTo(1 + 0.95 * 99, 4);
  });

  it('no penaliza a quien jugó menos: mismos goles en menos partidos valen más', () => {
    const fewMatches = valuator.valuate(makePlayer({ goals: 10, matchesPlayed: 10 }), goalsOnly);
    const manyMatches = valuator.valuate(makePlayer({ goals: 10, matchesPlayed: 30 }), goalsOnly);

    expect(fewMatches.value).toBeGreaterThan(manyMatches.value);
    expect(manyMatches.score).toBeCloseTo(38 / 120, 6);
  });

  it('con el método WEIGHTED esos mismos dos jugadores valen igual', () => {
    const weighted = new WeightedMetricsValuator();
    const strategy = makeStrategy({ goals: 1 });

    const fewMatches = weighted.valuate(makePlayer({ goals: 10, matchesPlayed: 10 }), strategy);
    const manyMatches = weighted.valuate(makePlayer({ goals: 10, matchesPlayed: 30 }), strategy);

    expect(fewMatches.value).toBe(manyMatches.value);
  });

  it('no altera las métricas que ya son promedio por partido', () => {
    const strategy = makeStrategy({ rating: 1 }, ValuationMethod.PER_MATCH);

    const { score } = valuator.valuate(makePlayer({ rating: 7.5, matchesPlayed: 10 }), strategy);

    expect(score).toBeCloseTo(0.75, 6);
  });

  it.each([null, 0])('sin partidos jugados (%s) cae a la normalización de temporada', (matchesPlayed) => {
    const { score } = valuator.valuate(makePlayer({ goals: 10, matchesPlayed }), goalsOnly);

    expect(score).toBeCloseTo(10 / 40, 6);
  });

  it('recorta a 1 cuando el promedio por partido supera el techo', () => {
    const { score } = valuator.valuate(makePlayer({ goals: 30, matchesPlayed: 10 }), goalsOnly);

    expect(score).toBe(1);
  });

  it('una métrica null cuenta como 0', () => {
    const { score } = valuator.valuate(makePlayer({ goals: null, matchesPlayed: 10 }), goalsOnly);

    expect(score).toBe(0);
  });

  it('también respeta el piso de valor con pesos negativos', () => {
    const strategy = makeStrategy({ yellowCards: -0.5, redCards: -0.5 }, ValuationMethod.PER_MATCH);

    const { score, value } = valuator.valuate(makePlayer({ yellowCards: 15, redCards: 5, matchesPlayed: 1 }), strategy);

    expect(score).toBe(-1);
    expect(value).toBe(MIN_PLAYER_VALUE);
  });
});

describe('piso del valor', () => {
  it('un score negativo no baja el valor de 1', () => {
    const strategy = makeStrategy({ yellowCards: -0.5, goals: 1.5 });
    const { value } = calculatePlayerValue(makePlayer({ yellowCards: 15 }), strategy);

    expect(value).toBe(MIN_PLAYER_VALUE);
  });

  it('sin tarjetas ni goles el valor es exactamente el piso', () => {
    const { value } = calculatePlayerValue(makePlayer({}), makeStrategy({ goals: 1 }));

    expect(value).toBe(MIN_PLAYER_VALUE);
  });

  it('un valor por encima del piso no se modifica', () => {
    const { value } = calculatePlayerValue(makePlayer({ goals: 40 }), makeStrategy({ goals: 1 }));

    expect(value).toBeCloseTo(100, 6);
  });
});

describe('ValuationStrategy.method', () => {
  it('por defecto es WEIGHTED', () => {
    expect(makeStrategy({ goals: 1 }).method).toBe(ValuationMethod.WEIGHTED);
    expect(
      ValuationStrategy.create({ id: 's', userId: 'u', name: 'n', weights: { goals: 1 }, factorEscala: 99, isSelected: true })
        .method,
    ).toBe(ValuationMethod.WEIGHTED);
  });

  it('withMethod devuelve una instancia nueva y no modifica la original', () => {
    const original = makeStrategy({ goals: 1 });

    const changed = original.withMethod(ValuationMethod.PER_MATCH);

    expect(changed.method).toBe(ValuationMethod.PER_MATCH);
    expect(original.method).toBe(ValuationMethod.WEIGHTED);
    expect(changed.id).toBe(original.id);
    expect(changed.weights).toEqual(original.weights);
  });

  it('el resto de las operaciones conserva el método', () => {
    const strategy = makeStrategy({ goals: 1 }, ValuationMethod.PER_MATCH);

    expect(strategy.select().method).toBe(ValuationMethod.PER_MATCH);
    expect(strategy.deselect().method).toBe(ValuationMethod.PER_MATCH);
    expect(strategy.withWeights({ assists: 1 }).method).toBe(ValuationMethod.PER_MATCH);
    expect(strategy.withPositionWeights(Position.FW, { goals: 1 }).method).toBe(ValuationMethod.PER_MATCH);
  });
});

describe('PlayerQuote.valuationMethod', () => {
  const base = {
    id: 'q-1',
    userId: 'user-1',
    playerId: 'player-1',
    strategyId: 'strategy-1',
    weightSnapshot: { goals: 1 },
    factorEscalaSnapshot: 99,
    score: 0.5,
    value: 50.5,
    calculatedAt: new Date('2026-10-26T12:00:00.000Z'),
  };

  it('por defecto es WEIGHTED', () => {
    expect(PlayerQuote.create(base).valuationMethod).toBe(ValuationMethod.WEIGHTED);
  });

  it('conserva el método con el que se produjo la cotización', () => {
    expect(PlayerQuote.create({ ...base, valuationMethod: ValuationMethod.PER_MATCH }).valuationMethod).toBe(
      ValuationMethod.PER_MATCH,
    );
  });
});

import { League } from '../../player/enums/league';
import { Position } from '../../player/enums/position';
import { Player } from '../../player/player';
import {
  calculatePlayerValue,
  NORMALIZATION_BOUNDS,
} from '../calculate-player-value';
import { ValuationStrategy } from '../valuation-strategy';

const STRATEGY_1_WEIGHTS = {
  goals: 0.25,
  assists: 0.15,
  shots: 0.10,
  keyPasses: 0.10,
  dribbles: 0.10,
  totalTackles: 0.10,
  rating: 0.20,
};

function makeStrategy(
  weights: Record<string, number>,
  factorEscala = 99,
): ValuationStrategy {
  return ValuationStrategy.restore({
    id: 'strategy-1',
    name: 'Test',
    weights,
    factorEscala,
    isActive: true,
  });
}

function makePlayer(metrics: {
  goals?: number | null;
  assists?: number | null;
  keyPasses?: number | null;
  dribbles?: number | null;
  totalTackles?: number | null;
  shots?: number | null;
  passesCompleted?: number | null;
  interceptions?: number | null;
  rating?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
} = {}): Player {
  return Player.restore({
    id: 'player-1',
    name: 'Test Player',
    league: League.PREMIER_LEAGUE,
    team: 'Test FC',
    position: Position.FW,
    passesCompleted: metrics.passesCompleted ?? null,
    shots: metrics.shots ?? null,
    interceptions: metrics.interceptions ?? null,
    rating: metrics.rating ?? null,
    goals: metrics.goals ?? null,
    assists: metrics.assists ?? null,
    keyPasses: metrics.keyPasses ?? null,
    dribbles: metrics.dribbles ?? null,
    totalTackles: metrics.totalTackles ?? null,
    yellowCards: metrics.yellowCards ?? null,
    redCards: metrics.redCards ?? null,
  });
}

describe('calculatePlayerValue', () => {
  describe('NORMALIZATION_BOUNDS', () => {
    it('expone los 11 bounds esperados', () => {
      expect(Object.keys(NORMALIZATION_BOUNDS)).toHaveLength(11);
      expect(NORMALIZATION_BOUNDS.goals).toBe(40);
      expect(NORMALIZATION_BOUNDS.assists).toBe(25);
      expect(NORMALIZATION_BOUNDS.shots).toBe(200);
      expect(NORMALIZATION_BOUNDS.passesCompleted).toBe(2500);
      expect(NORMALIZATION_BOUNDS.rating).toBe(10);
    });
  });

  describe('jugador con todas las métricas completas', () => {
    it('calcula value = 1 + score × factorEscala', () => {
      const strategy = makeStrategy(STRATEGY_1_WEIGHTS, 99);
      const player = makePlayer({
        goals: 20, assists: 10, shots: 100, keyPasses: 75,
        dribbles: 100, totalTackles: 75, rating: 7.5,
      });

      const { score, value } = calculatePlayerValue(player, strategy);

      const expectedScore =
        0.25 * (20 / 40) +
        0.15 * (10 / 25) +
        0.10 * (100 / 200) +
        0.10 * (75 / 150) +
        0.10 * (100 / 200) +
        0.10 * (75 / 150) +
        0.20 * (7.5 / 10);

      expect(score).toBeCloseTo(expectedScore, 6);
      expect(value).toBeCloseTo(1 + expectedScore * 99, 4);
    });
  });

  describe('métricas null se tratan como 0', () => {
    it('un jugador sin métricas tiene score 0 y value 1', () => {
      const strategy = makeStrategy(STRATEGY_1_WEIGHTS, 99);
      const player = makePlayer(); // todas null

      const { score, value } = calculatePlayerValue(player, strategy);

      expect(score).toBe(0);
      expect(value).toBe(1);
    });

    it('solo las métricas no null contribuyen al score', () => {
      const strategy = makeStrategy({ goals: 0.5, assists: 0.5 }, 10);
      const player = makePlayer({ goals: 20, assists: null });

      const { score, value } = calculatePlayerValue(player, strategy);
      const expectedScore = 0.5 * (20 / 40);

      expect(score).toBeCloseTo(expectedScore, 6);
      expect(value).toBeCloseTo(1 + expectedScore * 10, 6);
    });
  });

  describe('métrica que supera el bound se normaliza a 1.0', () => {
    it('goals > 40 → normalizado = 1.0', () => {
      const strategy = makeStrategy({ goals: 1.0 }, 99);
      const player = makePlayer({ goals: 999 });

      const { score, value } = calculatePlayerValue(player, strategy);

      expect(score).toBe(1.0);
      expect(value).toBeCloseTo(1 + 1.0 * 99, 4);
    });
  });

  describe('estrategia con pesos negativos', () => {
    it('jugador con tarjetas tiene score más bajo que jugador limpio', () => {
      const weights = {
        totalTackles: 0.25, interceptions: 0.20, passesCompleted: 0.20,
        assists: 0.20, keyPasses: 0.15, rating: 0.20,
        yellowCards: -0.05, redCards: -0.15,
      };
      const strategy = makeStrategy(weights, 99);

      const cleanPlayer = makePlayer({
        totalTackles: 100, interceptions: 60, passesCompleted: 1500,
        assists: 8, keyPasses: 50, rating: 7.0,
        yellowCards: 0, redCards: 0,
      });
      const dirtyPlayer = makePlayer({
        totalTackles: 100, interceptions: 60, passesCompleted: 1500,
        assists: 8, keyPasses: 50, rating: 7.0,
        yellowCards: 10, redCards: 2,
      });

      const { score: cleanScore } = calculatePlayerValue(cleanPlayer, strategy);
      const { score: dirtyScore } = calculatePlayerValue(dirtyPlayer, strategy);

      expect(dirtyScore).toBeLessThan(cleanScore);
    });

    it('score puede ser negativo si métricas disciplinarias dominan', () => {
      const weights = { yellowCards: -0.5, redCards: -0.5 };
      const strategy = makeStrategy(weights, 99);
      const player = makePlayer({ yellowCards: 15, redCards: 5 }); // bound máximo

      const { score, value } = calculatePlayerValue(player, strategy);

      expect(score).toBe(-1.0);
      expect(value).toBeCloseTo(1 + (-1.0) * 99, 4); // value = -98
    });
  });

  describe('verificación exacta con estrategia "Performance general" y jugador conocido', () => {
    it('calcula el score esperado para datos deterministas', () => {
      const strategy = makeStrategy(STRATEGY_1_WEIGHTS, 99);
      const player = makePlayer({
        goals: 40, assists: 25, shots: 200, keyPasses: 150,
        dribbles: 200, totalTackles: 150, rating: 10,
      });

      const { score, value } = calculatePlayerValue(player, strategy);

      // Con todas las métricas en su bound máximo, score = 1.0 (suma de todos los pesos)
      expect(score).toBeCloseTo(1.0, 5);
      expect(value).toBeCloseTo(100, 2); // 1 + 1.0 * 99 = 100
    });
  });
});

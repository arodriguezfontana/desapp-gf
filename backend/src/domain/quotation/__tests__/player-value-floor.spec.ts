import { League } from '../../player/enums/league';
import { Position } from '../../player/enums/position';
import { Player } from '../../player/player';
import { calculatePlayerValue, MIN_PLAYER_VALUE } from '../calculate-player-value';
import { ValuationStrategy } from '../valuation-strategy';

const makeStrategy = (weights: Record<string, number>): ValuationStrategy =>
  ValuationStrategy.restore({
    id: 'strategy-1',
    userId: 'user-1',
    name: 'Test',
    weights,
    factorEscala: 99,
    isSelected: true,
  });

const makePlayer = (metrics: { goals?: number; yellowCards?: number }): Player =>
  Player.restore({
    id: 'player-1',
    name: 'Test Player',
    league: League.PREMIER_LEAGUE,
    team: 'Test FC',
    position: Position.FW,
    passesCompleted: null,
    shots: null,
    interceptions: null,
    rating: null,
    goals: metrics.goals ?? null,
    yellowCards: metrics.yellowCards ?? null,
  });

describe('piso del valor de un jugador', () => {
  it('un score negativo no baja el valor de MIN_PLAYER_VALUE', () => {
    const { score, value } = calculatePlayerValue(
      makePlayer({ yellowCards: 15 }),
      makeStrategy({ yellowCards: -0.5, goals: 1.5 }),
    );

    expect(score).toBeLessThan(0);
    expect(value).toBe(MIN_PLAYER_VALUE);
  });

  it('sin goles ni tarjetas el valor es exactamente el piso', () => {
    const { value } = calculatePlayerValue(makePlayer({}), makeStrategy({ goals: 1 }));

    expect(value).toBe(MIN_PLAYER_VALUE);
  });

  it('un valor por encima del piso no se modifica', () => {
    const { value } = calculatePlayerValue(makePlayer({ goals: 40 }), makeStrategy({ goals: 1 }));

    expect(value).toBeCloseTo(100, 6);
  });

  it('el piso es 1', () => {
    expect(MIN_PLAYER_VALUE).toBe(1);
  });
});

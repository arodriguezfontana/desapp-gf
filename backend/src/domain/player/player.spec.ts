import { Player } from './player';
import { League } from './enums/league';
import { Position } from './enums/position';

describe('Player.restore', () => {
  it('expone exactamente los valores con los que se reconstruyó, incluidas las métricas', () => {
    const player = Player.restore({
      id: 'id-1',
      name: 'Milo Ashworth',
      league: League.PREMIER_LEAGUE,
      team: 'Northbridge FC',
      position: Position.GK,
      passesCompleted: 8.4,
      shots: 3.9,
      interceptions: 0.2,
      rating: 7.31,
      goals: 3,
      assists: 1,
      keyPasses: 13,
      dribbles: 2,
      totalTackles: 5,
      yellowCards: 0,
      redCards: 0,
    });

    expect(player.id).toBe('id-1');
    expect(player.name).toBe('Milo Ashworth');
    expect(player.league).toBe(League.PREMIER_LEAGUE);
    expect(player.team).toBe('Northbridge FC');
    expect(player.position).toBe(Position.GK);
    expect(player.passesCompleted).toBe(8.4);
    expect(player.shots).toBe(3.9);
    expect(player.interceptions).toBe(0.2);
    expect(player.rating).toBe(7.31);
    expect(player.goals).toBe(3);
    expect(player.assists).toBe(1);
    expect(player.keyPasses).toBe(13);
    expect(player.dribbles).toBe(2);
    expect(player.totalTackles).toBe(5);
    expect(player.yellowCards).toBe(0);
    expect(player.redCards).toBe(0);
  });

  it('expone las métricas en null cuando no hay valor disponible', () => {
    const player = Player.restore({
      id: 'id-2',
      name: 'Jugador Recién Debutado',
      league: League.LA_LIGA,
      team: 'Real Sociedad',
      position: Position.MF,
      passesCompleted: null,
      shots: null,
      interceptions: null,
      rating: null,
      goals: null,
      assists: null,
      keyPasses: null,
      dribbles: null,
      totalTackles: null,
      yellowCards: null,
      redCards: null,
    });

    expect(player.passesCompleted).toBeNull();
    expect(player.shots).toBeNull();
    expect(player.interceptions).toBeNull();
    expect(player.rating).toBeNull();
    expect(player.goals).toBeNull();
    expect(player.assists).toBeNull();
    expect(player.keyPasses).toBeNull();
    expect(player.dribbles).toBeNull();
    expect(player.totalTackles).toBeNull();
    expect(player.yellowCards).toBeNull();
    expect(player.redCards).toBeNull();
  });
});

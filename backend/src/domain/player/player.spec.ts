import { Player } from './player';
import { League } from './league';
import { Position } from './position';

describe('Player.restore', () => {
  it('expone exactamente los valores con los que se reconstruyó, incluidas las métricas', () => {
    const player = Player.restore(
      'id-1',
      'Milo Ashworth',
      League.PREMIER_LEAGUE,
      'Northbridge FC',
      Position.GK,
      8.4,
      3.9,
      0.2,
      7.31,
    );

    expect(player.id).toBe('id-1');
    expect(player.name).toBe('Milo Ashworth');
    expect(player.league).toBe(League.PREMIER_LEAGUE);
    expect(player.team).toBe('Northbridge FC');
    expect(player.position).toBe(Position.GK);
    expect(player.passesCompleted).toBe(8.4);
    expect(player.shots).toBe(3.9);
    expect(player.interceptions).toBe(0.2);
    expect(player.rating).toBe(7.31);
  });

  it('expone las 4 métricas en null cuando no hay valor disponible', () => {
    const player = Player.restore(
      'id-2',
      'Jugador Recién Debutado',
      League.LA_LIGA,
      'Real Sociedad',
      Position.MF,
      null,
      null,
      null,
      null,
    );

    expect(player.passesCompleted).toBeNull();
    expect(player.shots).toBeNull();
    expect(player.interceptions).toBeNull();
    expect(player.rating).toBeNull();
  });
});

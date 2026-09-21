import { Player } from './player';
import { League } from './league';
import { Position } from './position';

describe('Player.restore', () => {
  it('expone exactamente los valores con los que se reconstruyó', () => {
    const player = Player.restore(
      'id-1',
      'Milo Ashworth',
      League.PREMIER_LEAGUE,
      'Northbridge FC',
      Position.GK,
    );

    expect(player.id).toBe('id-1');
    expect(player.name).toBe('Milo Ashworth');
    expect(player.league).toBe(League.PREMIER_LEAGUE);
    expect(player.team).toBe('Northbridge FC');
    expect(player.position).toBe(Position.GK);
  });
});

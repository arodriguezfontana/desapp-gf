import { PlayerService } from './player.service';
import { PlayerRepository } from '../repositories/player.repository';
import { PlayerPage } from '../domain/player/player-page';
import { Player } from '../domain/player/player';
import { League } from '../domain/player/league';
import { Position } from '../domain/player/position';
import { PlayerNotFoundError } from '../domain/player/errors/player-not-found.error';

describe('PlayerService', () => {
  let players: jest.Mocked<PlayerRepository>;
  let service: PlayerService;

  const somePlayer = Player.restore(
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

  beforeEach(() => {
    players = {
      findPage: jest.fn(),
      findById: jest.fn(),
      findActiveExternalIdsByTeam: jest.fn(),
      applyTeamRosterSync: jest.fn(),
    };
    service = new PlayerService(players);
  });

  describe('listPlayers', () => {
    it('delega los filtros y la paginación tal cual al repositorio', async () => {
      const page: PlayerPage = { items: [somePlayer], total: 1 };
      players.findPage.mockResolvedValue(page);

      const filters = { league: League.PREMIER_LEAGUE };
      const pagination = { page: 2, pageSize: 5 };
      const result = await service.listPlayers(filters, pagination);

      expect(players.findPage).toHaveBeenCalledWith(filters, pagination);
      expect(result).toBe(page);
    });

    it('devuelve una lista vacía tal cual la da el repositorio (sin lanzar error)', async () => {
      players.findPage.mockResolvedValue({ items: [], total: 0 });

      const result = await service.listPlayers({}, { page: 1, pageSize: 10 });

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('getPlayerById', () => {
    it('devuelve el jugador tal cual lo da el repositorio cuando existe', async () => {
      players.findById.mockResolvedValue(somePlayer);

      const result = await service.getPlayerById('id-1');

      expect(players.findById).toHaveBeenCalledWith('id-1');
      expect(result).toBe(somePlayer);
    });

    it('lanza PlayerNotFoundError cuando el repositorio devuelve null', async () => {
      players.findById.mockResolvedValue(null);

      await expect(service.getPlayerById('id-inexistente')).rejects.toThrow(
        PlayerNotFoundError,
      );
    });
  });
});

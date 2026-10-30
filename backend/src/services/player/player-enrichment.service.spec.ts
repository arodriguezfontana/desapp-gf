import { PlayerEnrichmentService } from './player-enrichment.service';
import { PlayerService } from './player.service';
import { TeamRepository } from '../../repositories/competition/team.repository';
import { Player } from '../../domain/player/player';
import { Team } from '../../domain/competition/team';
import { League } from '../../domain/player/enums/league';
import { Position } from '../../domain/player/enums/position';
import { PlayerPage } from '../../domain/player/player-page';

describe('PlayerEnrichmentService', () => {
  let playerService: jest.Mocked<PlayerService>;
  let teams: jest.Mocked<TeamRepository>;
  let service: PlayerEnrichmentService;

  const somePlayer = Player.restore({
    id: 'id-1',
    name: 'Milo Ashworth',
    league: League.PREMIER_LEAGUE,
    team: 'Arsenal FC',
    position: Position.GK,
    passesCompleted: 8.4,
    shots: 3.9,
    interceptions: 0.2,
    rating: 7.31,
  });

  const someTeam = Team.restore('team-uuid', {
    whoScoredName: 'Arsenal FC',
    footballDataTeamId: 57,
    footballDataTeamName: 'Arsenal FC',
    leagueCode: 'PL',
    crestUrl: 'https://crests.football-data.org/57.png',
  });

  beforeEach(() => {
    playerService = {
      listPlayers: jest.fn(),
      findRanking: jest.fn(),
      getPlayerById: jest.fn(),
    } as unknown as jest.Mocked<PlayerService>;

    teams = {
      findByWhoScoredName: jest.fn(),
    } as unknown as typeof teams;

    service = new PlayerEnrichmentService(playerService, teams);
  });

  describe('listPlayersWithCrests', () => {
    it('adjunta el crestUrl cuando el equipo se resuelve en la tabla teams', async () => {
      const page: PlayerPage = { items: [somePlayer], total: 1 };
      playerService.listPlayers.mockResolvedValue(page);
      teams.findByWhoScoredName.mockResolvedValue(someTeam);

      const result = await service.listPlayersWithCrests({}, { page: 1, pageSize: 10 });

      expect(result.total).toBe(1);
      expect(result.items[0].player).toBe(somePlayer);
      expect(result.items[0].crestUrl).toBe('https://crests.football-data.org/57.png');
    });

    it('devuelve crestUrl null cuando el equipo no existe en la tabla teams', async () => {
      const page: PlayerPage = { items: [somePlayer], total: 1 };
      playerService.listPlayers.mockResolvedValue(page);
      teams.findByWhoScoredName.mockResolvedValue(null);

      const result = await service.listPlayersWithCrests({}, { page: 1, pageSize: 10 });

      expect(result.items[0].crestUrl).toBeNull();
    });

    it('devuelve crestUrl null cuando el equipo existe pero no tiene crest', async () => {
      const teamWithoutCrest = Team.restore('team-uuid', {
        whoScoredName: 'Arsenal FC',
        footballDataTeamId: 57,
        footballDataTeamName: 'Arsenal FC',
        leagueCode: 'PL',
        crestUrl: null,
      });
      const page: PlayerPage = { items: [somePlayer], total: 1 };
      playerService.listPlayers.mockResolvedValue(page);
      teams.findByWhoScoredName.mockResolvedValue(teamWithoutCrest);

      const result = await service.listPlayersWithCrests({}, { page: 1, pageSize: 10 });

      expect(result.items[0].crestUrl).toBeNull();
    });

    it('delega filters y pagination a PlayerService tal cual', async () => {
      const page: PlayerPage = { items: [], total: 0 };
      playerService.listPlayers.mockResolvedValue(page);

      const filters = { league: League.PREMIER_LEAGUE };
      const pagination = { page: 2, pageSize: 5 };
      await service.listPlayersWithCrests(filters, pagination);

      expect(playerService.listPlayers).toHaveBeenCalledWith(filters, pagination);
    });

    it('devuelve lista vacía sin consultar teams cuando no hay jugadores', async () => {
      playerService.listPlayers.mockResolvedValue({ items: [], total: 0 });

      const result = await service.listPlayersWithCrests({}, { page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(teams.findByWhoScoredName).not.toHaveBeenCalled();
    });
  });

  describe('getPlayerByIdWithCrest', () => {
    it('devuelve el jugador con su crestUrl cuando el equipo se resuelve', async () => {
      playerService.getPlayerById.mockResolvedValue(somePlayer);
      teams.findByWhoScoredName.mockResolvedValue(someTeam);

      const result = await service.getPlayerByIdWithCrest('id-1');

      expect(result.player).toBe(somePlayer);
      expect(result.crestUrl).toBe('https://crests.football-data.org/57.png');
    });

    it('devuelve crestUrl null cuando el equipo no está en la tabla teams', async () => {
      playerService.getPlayerById.mockResolvedValue(somePlayer);
      teams.findByWhoScoredName.mockResolvedValue(null);

      const result = await service.getPlayerByIdWithCrest('id-1');

      expect(result.crestUrl).toBeNull();
    });

    it('propaga PlayerNotFoundError si el jugador no existe', async () => {
      const { PlayerNotFoundError } = await import('../../domain/player/errors/player-not-found.error');
      playerService.getPlayerById.mockRejectedValue(new PlayerNotFoundError());

      await expect(service.getPlayerByIdWithCrest('id-x')).rejects.toThrow(PlayerNotFoundError);
    });
  });

  describe('getRankingWithCrests', () => {
    const quoteDate = new Date('2026-10-14T12:00:00Z');

    it('calcula la posición rank secuencial y enriquece crestUrl', async () => {
      const secondPlayer = Player.restore({
        id: 'id-2',
        name: 'Bukayo Saka',
        league: League.PREMIER_LEAGUE,
        team: 'Arsenal FC',
        position: Position.FW,
        passesCompleted: 15.2,
        shots: 4.1,
        interceptions: 0.5,
        rating: 7.85,
      });

      playerService.findRanking.mockResolvedValue({
        items: [
          {
            player: somePlayer,
            valor: 80000000,
            score: 9.1,
            strategyName: 'Elite Strategy',
            calculatedAt: quoteDate,
          },
          {
            player: secondPlayer,
            valor: 75000000,
            score: 8.8,
            strategyName: 'Elite Strategy',
            calculatedAt: quoteDate,
          },
        ],
        total: 10,
      });
      teams.findByWhoScoredName.mockResolvedValue(someTeam);

      const result = await service.getRankingWithCrests(
        'user-1',
        { league: League.PREMIER_LEAGUE },
        { page: 2, pageSize: 5 },
      );

      expect(playerService.findRanking).toHaveBeenCalledWith(
        'user-1',
        { league: League.PREMIER_LEAGUE },
        { page: 2, pageSize: 5 },
      );
      expect(result.total).toBe(10);
      expect(result.items).toHaveLength(2);

      // Página 2, pageSize 5 -> índice 0 es rank 6, índice 1 es rank 7
      expect(result.items[0]).toEqual({
        player: somePlayer,
        crestUrl: 'https://crests.football-data.org/57.png',
        rank: 6,
        valor: 80000000,
        score: 9.1,
        strategyName: 'Elite Strategy',
        calculatedAt: quoteDate,
      });
      expect(result.items[1].rank).toBe(7);
      expect(result.items[1].crestUrl).toBe('https://crests.football-data.org/57.png');
    });

    it('devuelve crestUrl null cuando el equipo no existe en la base de datos', async () => {
      playerService.findRanking.mockResolvedValue({
        items: [
          {
            player: somePlayer,
            valor: 50000000,
            score: 7.5,
            strategyName: 'Default Strategy',
            calculatedAt: quoteDate,
          },
        ],
        total: 1,
      });
      teams.findByWhoScoredName.mockResolvedValue(null);

      const result = await service.getRankingWithCrests('user-1', {}, { page: 1, pageSize: 10 });

      expect(result.items[0].rank).toBe(1);
      expect(result.items[0].crestUrl).toBeNull();
    });

    it('devuelve lista vacía sin llamar a teams cuando no hay items', async () => {
      playerService.findRanking.mockResolvedValue({ items: [], total: 0 });

      const result = await service.getRankingWithCrests('user-1', {}, { page: 1, pageSize: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(teams.findByWhoScoredName).not.toHaveBeenCalled();
    });
  });
});

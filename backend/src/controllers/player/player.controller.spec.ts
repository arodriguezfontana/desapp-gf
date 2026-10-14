import { PlayerController } from './player.controller';
import { PlayerEnrichmentService } from '../../services/player/player-enrichment.service';
import { QuotationService } from '../../services/quotation/quotation.service';
import { Player } from '../../domain/player/player';
import { League } from '../../domain/player/enums/league';
import { Position } from '../../domain/player/enums/position';
import { InvalidLeagueError } from '../../domain/player/errors/invalid-league.error';
import { InvalidPositionError } from '../../domain/player/errors/invalid-position.error';

describe('PlayerController', () => {
  let controller: PlayerController;
  let enrichmentService: jest.Mocked<PlayerEnrichmentService>;
  let quotationService: jest.Mocked<QuotationService>;

  const somePlayer = Player.restore({
    id: 'id-1',
    name: 'Kylian Mbappé',
    league: League.LA_LIGA,
    team: 'Real Madrid',
    position: Position.FW,
    matchesPlayed: 18,
    passesCompleted: 28.5,
    shots: 4.1,
    interceptions: 0.3,
    rating: 8.24,
    goals: 16,
    assists: 5,
    keyPasses: 24,
    dribbles: 38,
    totalTackles: 6,
    yellowCards: 1,
    redCards: 0,
  });

  beforeEach(() => {
    enrichmentService = {
      listPlayersWithCrests: jest.fn(),
      getRankingWithCrests: jest.fn(),
      getPlayerByIdWithCrest: jest.fn(),
    } as unknown as jest.Mocked<PlayerEnrichmentService>;

    quotationService = {
      getQuoteAtDate: jest.fn(),
      getQuoteHistory: jest.fn(),
    } as unknown as jest.Mocked<QuotationService>;

    controller = new PlayerController(enrichmentService, quotationService);
  });

  describe('ranking', () => {
    it('delega los filtros parseados y la paginación a PlayerEnrichmentService y formatea la respuesta', async () => {
      const quoteDate = new Date('2026-10-14T12:00:00Z');
      enrichmentService.getRankingWithCrests.mockResolvedValue({
        items: [
          {
            player: somePlayer,
            crestUrl: 'https://crests.football-data.org/86.png',
            rank: 1,
            valor: 450.0,
            score: 0.92345,
            strategyName: 'Estrategia Balanceada v1',
            calculatedAt: quoteDate,
          },
        ],
        total: 150,
      });

      const response = await controller.ranking({
        league: 'La Liga',
        position: 'FW',
        team: 'Real Madrid',
        page: 1,
        pageSize: 10,
      });

      expect(enrichmentService.getRankingWithCrests).toHaveBeenCalledWith(
        {
          league: League.LA_LIGA,
          team: 'Real Madrid',
          position: Position.FW,
        },
        { page: 1, pageSize: 10 },
      );

      expect(response.total).toBe(150);
      expect(response.page).toBe(1);
      expect(response.pageSize).toBe(10);
      expect(response.items).toHaveLength(1);
      expect(response.items[0]).toMatchObject({
        rank: 1,
        id: 'id-1',
        name: 'Kylian Mbappé',
        league: 'La Liga',
        team: 'Real Madrid',
        position: 'FW',
        crestUrl: 'https://crests.football-data.org/86.png',
        valor: 450.0,
        score: 0.92345,
        strategyName: 'Estrategia Balanceada v1',
        goals: 16,
      });
    });

    it('devuelve items: [] y total: 0 ante búsquedas sin coincidencias', async () => {
      enrichmentService.getRankingWithCrests.mockResolvedValue({
        items: [],
        total: 0,
      });

      const response = await controller.ranking({
        team: 'Equipo Inexistente',
        page: 1,
        pageSize: 10,
      });

      expect(response).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });
    });

    it('falla con InvalidLeagueError si la liga proporcionada no existe en el enum', async () => {
      await expect(
        controller.ranking({
          league: 'Liga Inventada',
          page: 1,
          pageSize: 10,
        }),
      ).rejects.toThrow(InvalidLeagueError);
    });

    it('falla con InvalidPositionError si la posición proporcionada no existe en el enum', async () => {
      await expect(
        controller.ranking({
          position: 'DELANTERO',
          page: 1,
          pageSize: 10,
        }),
      ).rejects.toThrow(InvalidPositionError);
    });
  });

  describe('list', () => {
    it('delega filtros parseados y retorna catálogo paginado con escudos', async () => {
      enrichmentService.listPlayersWithCrests.mockResolvedValue({
        items: [{ player: somePlayer, crestUrl: 'https://crests.football-data.org/86.png' }],
        total: 1,
      });

      const response = await controller.list({
        league: 'La Liga',
        page: 1,
        pageSize: 10,
      });

      expect(enrichmentService.listPlayersWithCrests).toHaveBeenCalledWith(
        { league: League.LA_LIGA, team: undefined, position: undefined },
        { page: 1, pageSize: 10 },
      );
      expect(response.total).toBe(1);
      expect(response.items[0].name).toBe('Kylian Mbappé');
    });
  });

  describe('detail', () => {
    it('retorna el jugador con su escudo enriquecido', async () => {
      enrichmentService.getPlayerByIdWithCrest.mockResolvedValue({
        player: somePlayer,
        crestUrl: 'https://crests.football-data.org/86.png',
      });

      const response = await controller.detail('id-1');

      expect(enrichmentService.getPlayerByIdWithCrest).toHaveBeenCalledWith('id-1');
      expect(response.name).toBe('Kylian Mbappé');
      expect(response.crestUrl).toBe('https://crests.football-data.org/86.png');
    });
  });
});


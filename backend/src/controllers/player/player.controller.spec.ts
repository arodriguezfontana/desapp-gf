import { PlayerController } from './player.controller';
import { PlayerEnrichmentService } from '../../services/player/player-enrichment.service';
import { QuotationService } from '../../services/quotation/quotation.service';
import { OrdersService } from '../../services/orders/orders.service';
import { OrderBook } from '../../domain/orders/order-book';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import { Player } from '../../domain/player/player';
import { League } from '../../domain/player/enums/league';
import { Position } from '../../domain/player/enums/position';
import { InvalidLeagueError } from '../../domain/player/errors/invalid-league.error';
import { InvalidPositionError } from '../../domain/player/errors/invalid-position.error';

describe('PlayerController', () => {
  let controller: PlayerController;
  let enrichmentService: jest.Mocked<PlayerEnrichmentService>;
  let quotationService: jest.Mocked<QuotationService>;
  let ordersService: jest.Mocked<OrdersService>;

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

    ordersService = {
      getOrderBook: jest.fn(),
    } as unknown as jest.Mocked<OrdersService>;

    controller = new PlayerController(enrichmentService, quotationService, ordersService);
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

      const response = await controller.ranking(
        {
          league: 'La Liga',
          position: 'FW',
          team: 'Real Madrid',
          page: 1,
          pageSize: 10,
        },
        'user-1',
      );

      expect(enrichmentService.getRankingWithCrests).toHaveBeenCalledWith(
        'user-1',
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

      const response = await controller.ranking(
        {
          team: 'Equipo Inexistente',
          page: 1,
          pageSize: 10,
        },
        'user-1',
      );

      expect(response).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });
    });

    it('falla con InvalidLeagueError si la liga proporcionada no existe en el enum', async () => {
      await expect(
        controller.ranking(
          {
            league: 'Liga Inventada',
            page: 1,
            pageSize: 10,
          },
          'user-1',
        ),
      ).rejects.toThrow(InvalidLeagueError);
    });

    it('falla con InvalidPositionError si la posición proporcionada no existe en el enum', async () => {
      await expect(
        controller.ranking(
          {
            position: 'DELANTERO',
            page: 1,
            pageSize: 10,
          },
          'user-1',
        ),
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

  describe('getOrderBook', () => {
    it('delega en OrdersService.getOrderBook y devuelve el DTO formateado con anonimato estricto', async () => {
      const orderBook = OrderBook.create(
        '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        [
          { price: 24.5, totalQuantity: 15 },
          { price: 23.0, totalQuantity: 30 },
        ],
        [
          { price: 25.0, totalQuantity: 10 },
          { price: 26.5, totalQuantity: 25 },
        ],
      );
      ordersService.getOrderBook.mockResolvedValue(orderBook);

      const response = await controller.getOrderBook('1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d');

      expect(ordersService.getOrderBook).toHaveBeenCalledWith('1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d');
      expect(response).toEqual({
        playerId: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        bids: [
          { price: '24.50', totalQuantity: 15 },
          { price: '23.00', totalQuantity: 30 },
        ],
        asks: [
          { price: '25.00', totalQuantity: 10 },
          { price: '26.50', totalQuantity: 25 },
        ],
      });

      // Verificación de anonimato estricto (US2): ningún campo de usuario o id de orden
      expect('userId' in response).toBe(false);
      expect('orderId' in response).toBe(false);
      response.bids.forEach((bid) => {
        expect('userId' in bid).toBe(false);
        expect('orderId' in bid).toBe(false);
      });
      response.asks.forEach((ask) => {
        expect('userId' in ask).toBe(false);
        expect('orderId' in ask).toBe(false);
      });
    });

    it('propaga PlayerNotFoundError cuando el jugador no existe', async () => {
      ordersService.getOrderBook.mockRejectedValue(new PlayerNotFoundError());

      await expect(controller.getOrderBook('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        PlayerNotFoundError,
      );
    });
  });
});

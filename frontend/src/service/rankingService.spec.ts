import { describe, it, expect, vi } from 'vitest';
import { rankingService } from './rankingService';
import { httpClient } from './httpClient';

vi.mock('./httpClient', () => ({
  httpClient: { get: vi.fn() },
}));

describe('rankingService', () => {
  it('getRanking llama a GET /players/ranking con ApiKey y retorna RankingResponseDto', async () => {
    const backendResponse = {
      items: [
        { id: '1', name: 'Messi', rank: 1, valor: 100.5, score: 95.2, strategyName: 'Promedio', league: 'La Liga', team: 'Barcelona', position: 'FW', passesCompleted: null, shots: null, interceptions: null, rating: null },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    };
    vi.mocked(httpClient.get).mockResolvedValueOnce(backendResponse);

    const result = await rankingService.getRanking({ page: 1, pageSize: 10 });

    expect(httpClient.get).toHaveBeenCalledWith('/players/ranking?page=1&pageSize=10');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].rank).toBe(1);
    expect(result.total).toBe(1);
  });

  it('getRanking sin params usa la URL sin query string', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 10 });

    await rankingService.getRanking();

    expect(httpClient.get).toHaveBeenCalledWith('/players/ranking');
  });

  it('getRanking con filtros los agrega a la query string', async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 10 });

    await rankingService.getRanking({ league: 'Premier League', position: 'GK' });

    expect(httpClient.get).toHaveBeenCalledWith(
      '/players/ranking?league=Premier+League&position=GK',
    );
  });
});

import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Test, TestingModule } from '@nestjs/testing';
import { PlayerEnrichmentService } from '../../src/services/player/player-enrichment.service';
import { PlayerService } from '../../src/services/player/player.service';
import { TeamRepository } from '../../src/repositories/competition/team.repository';
import { RedisCacheService } from '../../src/shared/cache/redis-cache.service';
import { QuotationCacheInvalidationListener } from '../../src/services/quotation/listeners/quotation-cache-invalidation.listener';
import { QuoteRecalculatedEvent } from '../../src/domain/alerts/events/quote-recalculated.event';
import { Player } from '../../src/domain/player/player';
import { League } from '../../src/domain/player/enums/league';
import { Position } from '../../src/domain/player/enums/position';

describe('Ranking Cache Integration (Enrichment + Listener + RedisCache)', () => {
  let enrichmentService: PlayerEnrichmentService;
  let invalidationListener: QuotationCacheInvalidationListener;
  let playerService: jest.Mocked<PlayerService>;
  let teamRepository: jest.Mocked<TeamRepository>;
  let cacheService: RedisCacheService;
  let inMemoryCache: Map<string, string>;

  const testPlayer = Player.restore({
    id: 'test-player-1',
    name: 'Bukayo Saka',
    league: League.PREMIER_LEAGUE,
    team: 'Arsenal FC',
    position: Position.FW,
  });

  beforeEach(async () => {
    inMemoryCache = new Map<string, string>();

    const mockRedisClient = {
      get: jest.fn().mockImplementation((key: string) => Promise.resolve(inMemoryCache.get(key) ?? null)),
      set: jest.fn().mockImplementation((key: string, val: string) => {
        inMemoryCache.set(key, val);
        return Promise.resolve('OK');
      }),
      del: jest.fn().mockImplementation((key: string) => {
        inMemoryCache.delete(key);
        return Promise.resolve(1);
      }),
      scanStream: jest.fn().mockImplementation(({ match }: { match: string }) => {
        const prefix = match.replace('*', '');
        const keys = Array.from(inMemoryCache.keys()).filter((k) => k.startsWith(prefix));
        return (async function* () {
          yield keys;
        })();
      }),
      pipeline: jest.fn().mockImplementation(() => ({
        del: jest.fn().mockImplementation((k: string) => inMemoryCache.delete(k)),
        exec: jest.fn().mockResolvedValue([]),
      })),
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    playerService = {
      listPlayers: jest.fn(),
      getPlayerById: jest.fn(),
      findRanking: jest.fn().mockResolvedValue({
        items: [
          {
            player: testPlayer,
            valor: 100000,
            score: 8.5,
            strategyName: 'Ofensiva',
            calculatedAt: new Date(),
          },
        ],
        total: 1,
      }),
    } as unknown as jest.Mocked<PlayerService>;

    teamRepository = {
      findByWhoScoredNames: jest.fn().mockResolvedValue([]),
      upsertTeams: jest.fn(),
    } as unknown as jest.Mocked<TeamRepository>;

    cacheService = new RedisCacheService(
      { get: jest.fn() } as unknown as ConfigService,
      mockRedisClient as unknown as Redis,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerEnrichmentService,
        QuotationCacheInvalidationListener,
        { provide: PlayerService, useValue: playerService },
        { provide: TeamRepository, useValue: teamRepository },
        { provide: RedisCacheService, useValue: cacheService },
      ],
    }).compile();

    enrichmentService = module.get<PlayerEnrichmentService>(PlayerEnrichmentService);
    invalidationListener = module.get<QuotationCacheInvalidationListener>(QuotationCacheInvalidationListener);
  });

  it('guarda el ranking de un usuario en caché y lo invalida ante evento quote.recalculated', async () => {
    const userId = 'user-test-uuid';

    // 1. Primera consulta: Cache Miss
    const r1 = await enrichmentService.getRankingWithCrests(userId, {}, { page: 1, pageSize: 10 });
    expect(r1.items[0].valor).toBe(100000);
    expect(playerService.findRanking).toHaveBeenCalledTimes(1);

    // 2. Segunda consulta: Cache Hit
    const r2 = await enrichmentService.getRankingWithCrests(userId, {}, { page: 1, pageSize: 10 });
    expect(r2.items[0].valor).toBe(100000);
    expect(playerService.findRanking).toHaveBeenCalledTimes(1);

    // 3. Disparar evento de recálculo para ese usuario
    const event = new QuoteRecalculatedEvent(userId, 'test-player-1', 110000, new Date());
    await invalidationListener.handleQuoteRecalculated(event);

    // 4. Tercera consulta: debe ser Cache Miss y volver a consultar la base
    await enrichmentService.getRankingWithCrests(userId, {}, { page: 1, pageSize: 10 });
    expect(playerService.findRanking).toHaveBeenCalledTimes(2);
  });

  it('la invalidación de un usuario no afecta la caché de ranking de otro usuario', async () => {
    const userA = 'user-A';
    const userB = 'user-B';

    // Poblar caché para ambos usuarios
    await enrichmentService.getRankingWithCrests(userA, {}, { page: 1, pageSize: 10 });
    await enrichmentService.getRankingWithCrests(userB, {}, { page: 1, pageSize: 10 });
    expect(playerService.findRanking).toHaveBeenCalledTimes(2);

    // Invalidar solo userA
    await invalidationListener.invalidateUserRanking(userA);

    // userB sigue en caché (no incrementa findRanking)
    await enrichmentService.getRankingWithCrests(userB, {}, { page: 1, pageSize: 10 });
    expect(playerService.findRanking).toHaveBeenCalledTimes(2);

    // userA vuelve a consultar la base
    await enrichmentService.getRankingWithCrests(userA, {}, { page: 1, pageSize: 10 });
    expect(playerService.findRanking).toHaveBeenCalledTimes(3);
  });
});

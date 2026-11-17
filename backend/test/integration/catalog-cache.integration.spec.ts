import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Test, TestingModule } from '@nestjs/testing';
import { PlayerEnrichmentService } from '../../src/services/player/player-enrichment.service';
import { PlayerService } from '../../src/services/player/player.service';
import { TeamRepository } from '../../src/repositories/competition/team.repository';
import { RedisCacheService } from '../../src/shared/cache/redis-cache.service';
import { Player } from '../../src/domain/player/player';
import { League } from '../../src/domain/player/enums/league';
import { Position } from '../../src/domain/player/enums/position';
import { Team } from '../../src/domain/competition/team';

describe('Catalog Cache Integration (PlayerEnrichmentService + RedisCacheService)', () => {
  let service: PlayerEnrichmentService;
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
    rating: 7.8,
  });

  const testTeam = Team.restore('team-1', {
    whoScoredName: 'Arsenal FC',
    footballDataTeamId: 57,
    footballDataTeamName: 'Arsenal FC',
    leagueCode: 'PL',
    crestUrl: 'https://crests.football-data.org/57.png',
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
      scanStream: jest.fn().mockImplementation(() => {
        const keys = Array.from(inMemoryCache.keys());
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
      listPlayers: jest.fn().mockResolvedValue({ items: [testPlayer], total: 1 }),
      getPlayerById: jest.fn().mockResolvedValue(testPlayer),
      findRanking: jest.fn(),
    } as unknown as jest.Mocked<PlayerService>;

    teamRepository = {
      findByWhoScoredNames: jest.fn().mockResolvedValue([testTeam]),
      upsertTeams: jest.fn(),
    } as unknown as jest.Mocked<TeamRepository>;

    cacheService = new RedisCacheService(
      { get: jest.fn() } as unknown as ConfigService,
      mockRedisClient as unknown as Redis,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerEnrichmentService,
        { provide: PlayerService, useValue: playerService },
        { provide: TeamRepository, useValue: teamRepository },
        { provide: RedisCacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<PlayerEnrichmentService>(PlayerEnrichmentService);
  });

  it('guarda en caché la primera consulta de catálogo y sirve la segunda desde memoria', async () => {
    // 1. Primera consulta: Cache Miss
    const firstResult = await service.listPlayersWithCrests({ league: League.PREMIER_LEAGUE }, { page: 1, pageSize: 10 });
    expect(firstResult.items[0].player.name).toBe('Bukayo Saka');
    expect(playerService.listPlayers).toHaveBeenCalledTimes(1);

    // 2. Segunda consulta idéntica: Cache Hit
    const secondResult = await service.listPlayersWithCrests({ league: League.PREMIER_LEAGUE }, { page: 1, pageSize: 10 });
    expect(secondResult.items[0].player.name).toBe('Bukayo Saka');
    // El repositorio NO debe haberse vuelto a llamar
    expect(playerService.listPlayers).toHaveBeenCalledTimes(1);
  });

  it('invalida la caché de catálogo cuando se purga el prefijo', async () => {
    // 1. Consultar y poblar caché
    await service.listPlayersWithCrests({}, { page: 1, pageSize: 10 });
    expect(playerService.listPlayers).toHaveBeenCalledTimes(1);

    // 2. Purgar prefijo de catálogo
    await cacheService.delByPrefix('futval:catalog:');

    // 3. Consultar nuevamente: debe ser un Cache Miss y volver a consultar la base
    await service.listPlayersWithCrests({}, { page: 1, pageSize: 10 });
    expect(playerService.listPlayers).toHaveBeenCalledTimes(2);
  });

  it('guarda en caché el detalle de jugador y sirve subsiguientes desde memoria', async () => {
    const firstResult = await service.getPlayerByIdWithCrest('test-player-1');
    expect(firstResult.player.id).toBe('test-player-1');
    expect(playerService.getPlayerById).toHaveBeenCalledTimes(1);

    const secondResult = await service.getPlayerByIdWithCrest('test-player-1');
    expect(secondResult.player.id).toBe('test-player-1');
    expect(playerService.getPlayerById).toHaveBeenCalledTimes(1);
  });
});

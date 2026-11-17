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

describe('Redis Fail-Open Integration', () => {
  let service: PlayerEnrichmentService;
  let playerService: jest.Mocked<PlayerService>;
  let teamRepository: jest.Mocked<TeamRepository>;
  let failingCacheService: RedisCacheService;

  const testPlayer = Player.restore({
    id: 'player-fail-open-1',
    name: 'Resilient Player',
    league: League.LA_LIGA,
    team: 'Real Madrid',
    position: Position.MF,
  });

  beforeEach(async () => {
    // Cliente de Redis que siempre rechaza con ECONNREFUSED
    const brokenRedisClient = {
      get: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
      set: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
      del: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
      ping: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
    };

    playerService = {
      listPlayers: jest.fn().mockResolvedValue({ items: [testPlayer], total: 1 }),
      getPlayerById: jest.fn().mockResolvedValue(testPlayer),
      findRanking: jest.fn().mockResolvedValue({
        items: [{
          player: testPlayer,
          valor: 75000,
          score: 8.0,
          strategyName: 'Equilibrada',
          calculatedAt: new Date(),
        }],
        total: 1,
      }),
    } as unknown as jest.Mocked<PlayerService>;

    teamRepository = {
      findByWhoScoredNames: jest.fn().mockResolvedValue([]),
      upsertTeams: jest.fn(),
    } as unknown as jest.Mocked<TeamRepository>;

    failingCacheService = new RedisCacheService(
      { get: jest.fn() } as unknown as ConfigService,
      brokenRedisClient as unknown as Redis,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerEnrichmentService,
        { provide: PlayerService, useValue: playerService },
        { provide: TeamRepository, useValue: teamRepository },
        { provide: RedisCacheService, useValue: failingCacheService },
      ],
    }).compile();

    service = module.get<PlayerEnrichmentService>(PlayerEnrichmentService);
  });

  it('listPlayersWithCrests responde 200 consultando PostgreSQL cuando Redis está caído (fail-open)', async () => {
    const result = await service.listPlayersWithCrests({}, { page: 1, pageSize: 10 });

    expect(result.total).toBe(1);
    expect(result.items[0].player.name).toBe('Resilient Player');
    expect(playerService.listPlayers).toHaveBeenCalledTimes(1);
  });

  it('getPlayerByIdWithCrest responde exitosamente cuando Redis está caído (fail-open)', async () => {
    const result = await service.getPlayerByIdWithCrest('player-fail-open-1');

    expect(result.player.name).toBe('Resilient Player');
    expect(playerService.getPlayerById).toHaveBeenCalledTimes(1);
  });

  it('getRankingWithCrests responde exitosamente cuando Redis está caído (fail-open)', async () => {
    const result = await service.getRankingWithCrests('user-1', {}, { page: 1, pageSize: 10 });

    expect(result.total).toBe(1);
    expect(result.items[0].valor).toBe(75000);
    expect(playerService.findRanking).toHaveBeenCalledTimes(1);
  });
});

import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseModule } from '../../database/database.module';
import { WHOSCORED_ADAPTER } from '../../modules/player-sync/player-sync.constants';
import { PLAYER_REPOSITORY } from '../../modules/player/player.constants';
import {
  WhoScoredAdapter,
  WhoScoredLeagueTeams,
  WhoScoredRawPlayer,
  WhoScoredTeamRef,
} from '../../adapters/player-sync/whoscored-adapter';
import { League } from '../../domain/player/enums/league';
import { PlayerEntity } from '../../repositories/player/entities/player.entity';
import { PlayerMapper } from '../../repositories/player/mappers/player.mapper';
import { TypeOrmPlayerRepository } from '../../repositories/player/typeorm-player.repository';
import { PlayerSyncService } from './player-sync.service';

class FakeWhoScoredAdapter implements WhoScoredAdapter {
  teamsByLeague = new Map<League, WhoScoredTeamRef[]>();
  rosterByTeam = new Map<string, WhoScoredRawPlayer[]>();

  fetchLeagueTeams(league: League): Promise<WhoScoredLeagueTeams> {
    const teams = this.teamsByLeague.get(league) ?? [];
    return Promise.resolve({
      tournamentId: 1,
      teams,
      seedPlayerByTeam: new Map(teams.map((t) => [t.externalTeamId, `seed-${t.externalTeamId}`])),
    });
  }

  fetchTeamRoster(team: WhoScoredTeamRef): Promise<WhoScoredRawPlayer[]> {
    return Promise.resolve(this.rosterByTeam.get(team.externalTeamId) ?? []);
  }
}

describe('PlayerSyncService — startManualRun (integración, spec 009)', () => {
  let moduleRef: TestingModule;
  let service: PlayerSyncService;
  let fakeAdapter: FakeWhoScoredAdapter;

  beforeAll(async () => {
    fakeAdapter = new FakeWhoScoredAdapter();

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PlayerEntity]),
      ],
      providers: [
        PlayerMapper,
        { provide: PLAYER_REPOSITORY, useClass: TypeOrmPlayerRepository },
        { provide: WHOSCORED_ADAPTER, useValue: fakeAdapter },
        PlayerSyncService,
      ],
    }).compile();

    service = moduleRef.get(PlayerSyncService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('startManualRun inicia la corrida y el estado pasa a completed con el resumen final', async () => {
    fakeAdapter.teamsByLeague.set(League.PREMIER_LEAGUE, [
      { externalTeamId: 'int-t1', team: 'Equipo Integración' },
    ]);
    fakeAdapter.rosterByTeam.set('int-t1', [
      {
        externalId: 'int-ws-1',
        name: 'Jugador Int',
        rawPosition: 'GK',
        metrics: {
          passesCompleted: 5,
          shots: 1,
          interceptions: 0.2,
          rating: 6.8,
          goals: 1,
          assists: 0,
          keyPasses: 2,
          dribbles: 0,
          totalTackles: 4,
          yellowCards: 0,
          redCards: 0,
        },
        metricsFetchFailed: false,
      },
    ]);

    const runId = service.startManualRun();
    expect(runId).toBeDefined();
    expect(service.getRun(runId)!.status).toBe('running');

    // Esperar que la corrida termine
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const state = service.getRun(runId);
        if (state && state.status !== 'running') {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    const state = service.getRun(runId);
    expect(state!.status).toBe('completed');
    expect(state!.summary).toBeDefined();
    expect(state!.summary!.teamsSynced).toBe(1);
    expect(state!.summary!.playersSynced).toBe(1);
    expect(state!.summary!.failedUnits).toHaveLength(0);
  });
});

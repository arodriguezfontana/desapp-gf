import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../database/database.module';
import { WHOSCORED_ADAPTER } from '../player-sync.constants';
import { PLAYER_REPOSITORY } from '../player.constants';
import {
  WhoScoredAdapter,
  WhoScoredLeagueTeams,
  WhoScoredRawPlayer,
  WhoScoredTeamRef,
} from '../adapters/whoscored-adapter';
import { League } from '../domain/player/league';
import { PlayerEntity } from '../repositories/entities/player.entity';
import { PlayerMapper } from '../repositories/mappers/player.mapper';
import { TypeOrmPlayerRepository } from '../repositories/typeorm-player.repository';
import { PlayerSyncService } from './player-sync.service';

/**
 * Fake sin HTTP: los tests de PlayerSyncService no dependen del parseo real
 * de WhoScored (eso lo cubre http-whoscored-adapter.spec.ts). Sin campos que
 * un método escriba para que otro lea después (research.md §1 de
 * 006-whoscored-catalog-sync): `tournamentId` es una constante fija y el
 * jugador semilla de cada equipo se deriva de `teamsByLeague` en el momento,
 * nunca se guarda entre llamadas.
 */
class FakeWhoScoredAdapter implements WhoScoredAdapter {
  static readonly TOURNAMENT_ID = 2;

  rosterByTeam = new Map<string, WhoScoredRawPlayer[]>();
  teamsByLeague = new Map<League, WhoScoredTeamRef[]>();
  failingLeagues = new Set<League>();

  fetchLeagueTeams(league: League): Promise<WhoScoredLeagueTeams> {
    if (this.failingLeagues.has(league)) {
      return Promise.reject(new Error('WhoScored caído'));
    }
    const teams = this.teamsByLeague.get(league) ?? [];
    return Promise.resolve({
      tournamentId: FakeWhoScoredAdapter.TOURNAMENT_ID,
      teams,
      seedPlayerByTeam: new Map(
        teams.map((t) => [t.externalTeamId, `seed-${t.externalTeamId}`]),
      ),
    });
  }

  fetchTeamRoster(team: WhoScoredTeamRef): Promise<WhoScoredRawPlayer[]> {
    return Promise.resolve(this.rosterByTeam.get(team.externalTeamId) ?? []);
  }
}

const rawPlayer = (
  externalId: string,
  name: string,
  rawPosition = 'GK',
): WhoScoredRawPlayer => ({
  externalId,
  name,
  rawPosition,
  metrics: { passesCompleted: 5, shots: 1, interceptions: 0.2, rating: 6.8 },
  metricsFetchFailed: false,
});

describe('PlayerSyncService (integración contra Postgres real, WhoScoredAdapter fake)', () => {
  let moduleRef: TestingModule;
  let service: PlayerSyncService;
  let fakeAdapter: FakeWhoScoredAdapter;
  let dataSource: DataSource;

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
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(PlayerEntity).clear();
    fakeAdapter.teamsByLeague.clear();
    fakeAdapter.rosterByTeam.clear();
    fakeAdapter.failingLeagues.clear();
  });

  it('una corrida completa deja el catálogo con los jugadores esperados de cada equipo sincronizado', async () => {
    fakeAdapter.teamsByLeague.set(League.PREMIER_LEAGUE, [
      { externalTeamId: 't1', team: 'Equipo Uno' },
    ]);
    fakeAdapter.teamsByLeague.set(League.LA_LIGA, [
      { externalTeamId: 't2', team: 'Equipo Dos' },
    ]);
    fakeAdapter.rosterByTeam.set('t1', [rawPlayer('ws-1', 'Jugador Uno', 'GK')]);
    fakeAdapter.rosterByTeam.set('t2', [rawPlayer('ws-2', 'Jugador Dos', 'FW')]);

    await service.sync();

    const rows = await dataSource.getRepository(PlayerEntity).find();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId).sort()).toEqual(['ws-1', 'ws-2']);
  });

  it('una corrida posterior da de baja a los jugadores que ya no aparecen y reactiva a los que vuelven', async () => {
    fakeAdapter.teamsByLeague.set(League.SERIE_A, [
      { externalTeamId: 't3', team: 'Equipo Tres' },
    ]);
    fakeAdapter.rosterByTeam.set('t3', [
      rawPlayer('ws-3', 'Se Queda'),
      rawPlayer('ws-4', 'Se Va'),
    ]);
    await service.sync();

    // Segunda corrida: ws-4 ya no está, ws-3 sigue.
    fakeAdapter.rosterByTeam.set('t3', [rawPlayer('ws-3', 'Se Queda')]);
    await service.sync();

    const active = await dataSource
      .getRepository(PlayerEntity)
      .find({ where: { team: 'Equipo Tres' } });
    const seQueda = active.find((p) => p.externalId === 'ws-3');
    const seVa = active.find((p) => p.externalId === 'ws-4');
    expect(seQueda?.removedAt).toBeNull();
    expect(seVa?.removedAt).not.toBeNull();

    // Tercera corrida: ws-4 vuelve a aparecer -> se reactiva, no se duplica.
    fakeAdapter.rosterByTeam.set('t3', [
      rawPlayer('ws-3', 'Se Queda'),
      rawPlayer('ws-4', 'Se Va'),
    ]);
    await service.sync();

    const rows = await dataSource
      .getRepository(PlayerEntity)
      .find({ where: { team: 'Equipo Tres' } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.removedAt === null)).toBe(true);
  });

  it('una liga que falla no persiste nada de esa liga y no afecta a las demás', async () => {
    fakeAdapter.teamsByLeague.set(League.BUNDESLIGA, [
      { externalTeamId: 't5', team: 'Equipo Cinco' },
    ]);
    fakeAdapter.failingLeagues.add(League.LIGUE_1);
    fakeAdapter.rosterByTeam.set('t5', [rawPlayer('ws-5', 'Jugador Cinco')]);

    await expect(service.sync()).resolves.toBeUndefined();

    const rows = await dataSource.getRepository(PlayerEntity).find();
    expect(rows.map((r) => r.externalId)).toEqual(['ws-5']);
  });
});

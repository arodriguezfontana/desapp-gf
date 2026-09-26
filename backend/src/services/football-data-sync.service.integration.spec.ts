import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { DatabaseModule } from '../database/database.module';
import { MatchEntity } from '../repositories/entities/match.entity';
import { StandingEntity } from '../repositories/entities/standing.entity';
import { TypeOrmMatchRepository } from '../repositories/typeorm-match.repository';
import { MatchMapper } from '../repositories/mappers/match.mapper';
import { TypeOrmStandingRepository } from '../repositories/typeorm-standing.repository';
import { StandingMapper } from '../repositories/mappers/standing.mapper';
import { FootballDataSyncService } from './football-data-sync.service';
import { FOOTBALL_DATA_ADAPTER, FootballDataAdapter } from '../adapters/football-data-adapter';
import { MATCH_REPOSITORY } from '../repositories/match.repository';
import { STANDING_REPOSITORY } from '../repositories/standing.repository';

interface StandingsFixtureRow {
  position: number;
  playedGames: number;
  form?: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  team: { id: number; name: string; crest?: string | null };
}

interface MatchesFixtureRow {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  season?: { id?: number };
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score?: { fullTime?: { home: number | null; away: number | null } };
}

describe('FootballDataSyncService (Integration against Postgres with Mocked Adapter)', () => {
  let moduleRef: TestingModule;
  let syncService: FootballDataSyncService;
  let dataSource: DataSource;
  let mockAdapter: jest.Mocked<FootballDataAdapter>;

  const matchesFixture = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../test/fixtures/football-data/matches-sample.json'),
      'utf-8',
    ),
  );

  const standingsFixture = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../test/fixtures/football-data/standings-sample.json'),
      'utf-8',
    ),
  );

  beforeAll(async () => {
    mockAdapter = {
      fetchMatches: jest.fn(),
      fetchStandings: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([MatchEntity, StandingEntity]),
      ],
      providers: [
        FootballDataSyncService,
        MatchMapper,
        StandingMapper,
        { provide: FOOTBALL_DATA_ADAPTER, useValue: mockAdapter },
        { provide: MATCH_REPOSITORY, useClass: TypeOrmMatchRepository },
        { provide: STANDING_REPOSITORY, useClass: TypeOrmStandingRepository },
      ],
    }).compile();

    syncService = moduleRef.get(FootballDataSyncService);
    syncService.setRequestDelay(0); // Zero delay for tests
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(MatchEntity).clear();
    await dataSource.getRepository(StandingEntity).clear();

    // Setup default mock responses
    mockAdapter.fetchStandings.mockImplementation(async (code: string) => {
      if (code === 'PL') {
        const table = standingsFixture.standings[0].table;
        return table.map((r: StandingsFixtureRow) => ({
          position: r.position,
          teamId: r.team.id,
          teamName: r.team.name,
          crestUrl: r.team.crest || null,
          playedGames: r.playedGames,
          form: r.form || null,
          won: r.won,
          draw: r.draw,
          lost: r.lost,
          points: r.points,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          goalDifference: r.goalDifference,
        }));
      }
      return [];
    });

    mockAdapter.fetchMatches.mockImplementation(async (code: string) => {
      if (code === 'PL') {
        return matchesFixture.matches.map((m: MatchesFixtureRow) => ({
          id: m.id,
          utcDate: m.utcDate,
          status: m.status,
          matchday: m.matchday,
          competitionCode: code,
          seasonYear: m.season?.id || 2025,
          homeTeamId: m.homeTeam.id,
          homeTeamName: m.homeTeam.name,
          awayTeamId: m.awayTeam.id,
          awayTeamName: m.awayTeam.name,
          homeScore: m.score?.fullTime?.home ?? null,
          awayScore: m.score?.fullTime?.away ?? null,
        }));
      }
      return [];
    });
  });

  it('should sync all 5 leagues, persisting matches and standings into Postgres', async () => {
    await syncService.syncAllLeagues();

    const matchRepo = dataSource.getRepository(MatchEntity);
    const standingRepo = dataSource.getRepository(StandingEntity);

    const matches = await matchRepo.find({ where: { leagueCode: 'PL' } });
    const standings = await standingRepo.find({ where: { leagueCode: 'PL' } });

    // In fixture: 1 FINISHED, 2 SCHEDULED/TIMED, 1 POSTPONED (deferred), 1 CANCELLED (permanently ignored)
    expect(matches).toHaveLength(3);

    const finishedMatch = matches.find((m) => m.status === 'FINISHED');
    expect(finishedMatch).toBeDefined();
    expect(finishedMatch?.classification).toBe('RESULT');
    expect(finishedMatch?.homeScore).toBe(3);
    expect(finishedMatch?.awayScore).toBe(0);

    const scheduledMatch = matches.find((m) => m.status === 'SCHEDULED');
    expect(scheduledMatch).toBeDefined();
    expect(scheduledMatch?.classification).toBe('FIXTURE');
    expect(scheduledMatch?.homeScore).toBeNull();

    // Standings: 3 teams in fixture
    expect(standings).toHaveLength(3);
    const manCityStanding = standings.find((s) => s.externalTeamId === 65);
    expect(manCityStanding?.points).toBe(13);
    expect(manCityStanding?.crestUrl).toBe('https://crests.football-data.org/65.png');

    const manUtdStanding = standings.find((s) => s.externalTeamId === 66);
    expect(manUtdStanding?.crestUrl).toBeNull();
  });
});


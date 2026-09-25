import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { MatchEntity } from './entities/match.entity';
import { TypeOrmMatchRepository } from './typeorm-match.repository';

describe('TypeOrmMatchRepository (Integration against Postgres)', () => {
  let moduleRef: TestingModule;
  let repository: TypeOrmMatchRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([MatchEntity]),
      ],
      providers: [TypeOrmMatchRepository],
    }).compile();

    repository = moduleRef.get(TypeOrmMatchRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(MatchEntity).clear();
  });

  it('should upsert match rows correctly by externalId', async () => {
    await repository.upsertMatches([
      {
        externalId: 497521,
        leagueCode: 'PL',
        season: 2025,
        matchday: 1,
        utcDate: new Date('2025-08-15T19:00:00Z'),
        status: 'SCHEDULED',
        classification: 'FIXTURE',
        homeTeamId: 65,
        homeTeamName: 'Manchester City FC',
        awayTeamId: 62,
        awayTeamName: 'Everton FC',
        homeScore: null,
        awayScore: null,
      },
    ]);

    let match = await repository.findByExternalId(497521);
    expect(match).not.toBeNull();
    expect(match?.status).toBe('SCHEDULED');
    expect(match?.homeScore).toBeNull();

    // Update match when finished with score
    await repository.upsertMatches([
      {
        externalId: 497521,
        leagueCode: 'PL',
        season: 2025,
        matchday: 1,
        utcDate: new Date('2025-08-15T19:00:00Z'),
        status: 'FINISHED',
        classification: 'RESULT',
        homeTeamId: 65,
        homeTeamName: 'Manchester City FC',
        awayTeamId: 62,
        awayTeamName: 'Everton FC',
        homeScore: 3,
        awayScore: 0,
      },
    ]);

    match = await repository.findByExternalId(497521);
    expect(match?.status).toBe('FINISHED');
    expect(match?.homeScore).toBe(3);
    expect(match?.awayScore).toBe(0);

    const matches = await repository.findByLeagueCode('PL');
    expect(matches).toHaveLength(1);
  });
});


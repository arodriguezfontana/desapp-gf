import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { Standing } from '../domain/standing';
import { StandingEntity } from './entities/standing.entity';
import { StandingMapper } from './mappers/standing.mapper';
import { TypeOrmStandingRepository } from './typeorm-standing.repository';

describe('TypeOrmStandingRepository (Integration against Postgres)', () => {
  let moduleRef: TestingModule;
  let repository: TypeOrmStandingRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([StandingEntity]),
      ],
      providers: [TypeOrmStandingRepository, StandingMapper],
    }).compile();

    repository = moduleRef.get(TypeOrmStandingRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(StandingEntity).clear();
  });

  it('should upsert standing rows correctly by (externalTeamId, leagueCode)', async () => {
    await repository.upsertStandings([
      Standing.create({
        externalTeamId: 65,
        teamName: 'Manchester City FC',
        leagueCode: 'PL',
        season: 2025,
        position: 1,
        playedGames: 5,
        won: 4,
        draw: 1,
        lost: 0,
        points: 13,
        goalsFor: 12,
        goalsAgainst: 3,
        goalDifference: 9,
        form: 'W,W,W,D,W',
        crestUrl: 'https://crests.football-data.org/65.png',
      }),
    ]);

    let standing = await repository.findByTeamAndLeague(65, 'PL');
    expect(standing).not.toBeNull();
    expect(standing?.points).toBe(13);
    expect(standing?.position).toBe(1);

    // Upsert with updated points
    await repository.upsertStandings([
      Standing.create({
        externalTeamId: 65,
        teamName: 'Manchester City FC',
        leagueCode: 'PL',
        season: 2025,
        position: 1,
        playedGames: 6,
        won: 5,
        draw: 1,
        lost: 0,
        points: 16,
        goalsFor: 15,
        goalsAgainst: 3,
        goalDifference: 12,
        form: 'W,W,W,W,D,W',
        crestUrl: 'https://crests.football-data.org/65.png',
      }),
    ]);

    standing = await repository.findByTeamAndLeague(65, 'PL');
    expect(standing?.points).toBe(16);
    expect(standing?.playedGames).toBe(6);

    const all = await repository.findByLeagueCode('PL');
    expect(all).toHaveLength(1);
  });
});


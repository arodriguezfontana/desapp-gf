import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../../database/database.module';
import { TeamNameExceptionEntity } from './entities/team-name-exception.entity';
import { TeamNameExceptionMapper } from './mappers/team-name-exception.mapper';
import { TypeOrmTeamNameExceptionRepository } from './typeorm-team-name-exception.repository';

describe('TypeOrmTeamNameExceptionRepository (Integration against Postgres)', () => {
  let moduleRef: TestingModule;
  let repository: TypeOrmTeamNameExceptionRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([TeamNameExceptionEntity]),
      ],
      providers: [TypeOrmTeamNameExceptionRepository, TeamNameExceptionMapper],
    }).compile();

    repository = moduleRef.get(TypeOrmTeamNameExceptionRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(TeamNameExceptionEntity).clear();
  });

  it('devuelve array vacío cuando la tabla no tiene filas', async () => {
    const result = await repository.findAll();
    expect(result).toEqual([]);
  });

  it('devuelve las excepciones correctamente mapeadas a dominio', async () => {
    await dataSource.getRepository(TeamNameExceptionEntity).save([
      {
        whoScoredRawName: 'Lyon',
        footballDataTeamId: 1234,
        footballDataTeamName: 'Olympique Lyonnais',
        leagueCode: 'FL1',
      },
      {
        whoScoredRawName: 'Atletico',
        footballDataTeamId: 78,
        footballDataTeamName: 'Atlético de Madrid',
        leagueCode: 'PD',
      },
    ]);

    const result = await repository.findAll();

    expect(result).toHaveLength(2);

    const lyon = result.find((e) => e.whoScoredRawName === 'Lyon');
    expect(lyon).toBeDefined();
    expect(lyon?.footballDataTeamId).toBe(1234);
    expect(lyon?.footballDataTeamName).toBe('Olympique Lyonnais');
    expect(lyon?.leagueCode).toBe('FL1');
    expect(lyon?.id).toBeTruthy();

    const atletico = result.find((e) => e.whoScoredRawName === 'Atletico');
    expect(atletico).toBeDefined();
    expect(atletico?.footballDataTeamId).toBe(78);
  });
});

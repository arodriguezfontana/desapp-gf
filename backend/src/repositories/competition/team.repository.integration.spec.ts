import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../../database/database.module';
import { TeamEntity } from './entities/team.entity';
import { TeamMapper } from './mappers/team.mapper';
import { TeamRepository } from './team.repository';

const BASE_PROPS = {
  footballDataTeamId: 86,
  footballDataTeamName: 'Real Madrid CF',
  leagueCode: 'PD',
  crestUrl: 'https://crests.football-data.org/86.png',
};

describe('TeamRepository (integración)', () => {
  let moduleRef: TestingModule;
  let repo: TeamRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([TeamEntity]),
      ],
      providers: [TeamMapper, TeamRepository],
    }).compile();

    repo = moduleRef.get(TeamRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await dataSource.query(`DELETE FROM "teams" WHERE "whoscored_name" LIKE 'Test%'`);
  });

  const insertTeam = async (
    whoScoredName: string,
    overrides: Omit<Partial<typeof BASE_PROPS>, 'crestUrl'> & { crestUrl?: string | null } = {},
  ) => {
    const id = randomUUID();
    await dataSource.getRepository(TeamEntity).insert({
      id,
      whoScoredName,
      ...BASE_PROPS,
      ...overrides,
    });
    return id;
  };

  describe('findByWhoScoredName', () => {
    it('retorna el equipo cuando existe', async () => {
      await insertTeam('Test Real Madrid');

      const team = await repo.findByWhoScoredName('Test Real Madrid');

      expect(team).not.toBeNull();
      expect(team!.whoScoredName).toBe('Test Real Madrid');
      expect(team!.footballDataTeamId).toBe(86);
      expect(team!.leagueCode).toBe('PD');
    });

    it('retorna null cuando el equipo no existe', async () => {
      const result = await repo.findByWhoScoredName('Test Equipo Inexistente');

      expect(result).toBeNull();
    });

    it('retorna null con crestUrl null', async () => {
      await insertTeam('Test Sin Escudo', { crestUrl: null });

      const team = await repo.findByWhoScoredName('Test Sin Escudo');

      expect(team).not.toBeNull();
      expect(team!.crestUrl).toBeNull();
    });
  });
});

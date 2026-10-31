import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../../database/database.module';
import { Team } from '../../domain/competition/team';
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

  describe('findByWhoScoredNames', () => {
    it('retorna el equipo cuando existe', async () => {
      await insertTeam('Test Real Madrid');

      const [team] = await repo.findByWhoScoredNames(['Test Real Madrid']);

      expect(team.whoScoredName).toBe('Test Real Madrid');
      expect(team.footballDataTeamId).toBe(86);
      expect(team.leagueCode).toBe('PD');
    });

    it('retorna lista vacia cuando el equipo no existe', async () => {
      const result = await repo.findByWhoScoredNames(['Test Equipo Inexistente']);

      expect(result).toEqual([]);
    });

    it('retorna el equipo con crestUrl null', async () => {
      await insertTeam('Test Sin Escudo', { crestUrl: null });

      const [team] = await repo.findByWhoScoredNames(['Test Sin Escudo']);

      expect(team.crestUrl).toBeNull();
    });

    it('resuelve varios equipos en una sola consulta e ignora los que no existen', async () => {
      await insertTeam('Test Real Madrid');
      await insertTeam('Test Sevilla', { footballDataTeamId: 559 });

      const result = await repo.findByWhoScoredNames(['Test Real Madrid', 'Test Sevilla', 'Test Inexistente']);

      expect(result.map((t) => t.whoScoredName).sort()).toEqual(['Test Real Madrid', 'Test Sevilla']);
    });
  });

  describe('upsertTeams', () => {
    it('inserta un equipo nuevo', async () => {
      const team = Team.create({ whoScoredName: 'Test FC Barcelona', footballDataTeamId: 81, footballDataTeamName: 'FC Barcelona', leagueCode: 'PD', crestUrl: null });

      await repo.upsertTeams([team]);

      const [found] = await repo.findByWhoScoredNames(['Test FC Barcelona']);
      expect(found.footballDataTeamId).toBe(81);
    });

    it('actualiza el equipo existente sin duplicar (upsert por whoScoredName)', async () => {
      await insertTeam('Test Atletico Madrid', { footballDataTeamId: 78 });

      const updated = Team.create({ whoScoredName: 'Test Atletico Madrid', footballDataTeamId: 78, footballDataTeamName: 'Club Atlético de Madrid', leagueCode: 'PD', crestUrl: null });
      await repo.upsertTeams([updated]);

      const all = await dataSource.getRepository(TeamEntity).find({ where: { whoScoredName: 'Test Atletico Madrid' } });
      expect(all).toHaveLength(1);
      expect(all[0].footballDataTeamName).toBe('Club Atlético de Madrid');
    });

    it('inserta múltiples equipos en una sola llamada', async () => {
      const teams = [
        Team.create({ whoScoredName: 'Test Sevilla', footballDataTeamId: 559, footballDataTeamName: 'Sevilla FC', leagueCode: 'PD', crestUrl: null }),
        Team.create({ whoScoredName: 'Test Valencia', footballDataTeamId: 95, footballDataTeamName: 'Valencia CF', leagueCode: 'PD', crestUrl: null }),
      ];

      await repo.upsertTeams(teams);

      const found = await repo.findByWhoScoredNames(['Test Sevilla', 'Test Valencia']);
      expect(found).toHaveLength(2);
    });

    it('no falla con array vacío', async () => {
      await expect(repo.upsertTeams([])).resolves.toBeUndefined();
    });
  });
});

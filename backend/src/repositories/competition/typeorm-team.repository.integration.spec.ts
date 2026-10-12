import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../../database/database.module';
import { Team } from '../../domain/competition/team';
import { TeamEntity } from './entities/team.entity';
import { TeamMapper } from './mappers/team.mapper';
import { TypeOrmTeamRepository } from './typeorm-team.repository';

const BASE_PROPS = {
  footballDataTeamId: 86,
  footballDataTeamName: 'Real Madrid CF',
  leagueCode: 'PD',
  crestUrl: 'https://crests.football-data.org/86.png',
};

describe('TypeOrmTeamRepository (integración)', () => {
  let moduleRef: TestingModule;
  let repo: TypeOrmTeamRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([TeamEntity]),
      ],
      providers: [TeamMapper, TypeOrmTeamRepository],
    }).compile();

    repo = moduleRef.get(TypeOrmTeamRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await dataSource.query(`DELETE FROM "teams" WHERE "whoscored_name" LIKE 'Test%'`);
  });

  const insertTeam = async (whoScoredName: string, overrides: Partial<typeof BASE_PROPS> = {}) => {
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

  describe('upsertTeams', () => {
    it('inserta un equipo nuevo', async () => {
      const team = Team.create({ whoScoredName: 'Test FC Barcelona', footballDataTeamId: 81, footballDataTeamName: 'FC Barcelona', leagueCode: 'PD', crestUrl: null });

      await repo.upsertTeams([team]);

      const found = await repo.findByWhoScoredName('Test FC Barcelona');
      expect(found).not.toBeNull();
      expect(found!.footballDataTeamId).toBe(81);
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

      expect(await repo.findByWhoScoredName('Test Sevilla')).not.toBeNull();
      expect(await repo.findByWhoScoredName('Test Valencia')).not.toBeNull();
    });

    it('no falla con array vacío', async () => {
      await expect(repo.upsertTeams([])).resolves.toBeUndefined();
    });
  });
});

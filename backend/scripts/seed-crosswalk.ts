/**
 * Script de crosswalk WhoScored ↔ Football-Data.
 * Resuelve los equipos de los jugadores contra los standings de Football-Data
 * y hace upsert en la tabla `teams` con el resultado.
 *
 * Uso: npm run seed:crosswalk (desde backend/)
 * Requiere en .env: DATABASE_URL, FOOTBALL_DATA_API_TOKEN
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as pg from 'pg';
import { DataSource } from 'typeorm';
import { PlayerEntity } from '../src/repositories/player/entities/player.entity';
import { StandingEntity } from '../src/repositories/competition/entities/standing.entity';
import { TeamNameExceptionEntity } from '../src/repositories/competition/entities/team-name-exception.entity';
import { TeamEntity } from '../src/repositories/competition/entities/team.entity';
import { TeamNameException } from '../src/domain/competition/team-name-exception';
import { Standing } from '../src/domain/competition/standing';
import { resolveTeam } from '../src/domain/competition/resolve-team';
import { HttpFootballDataAdapter } from '../src/adapters/competition/http-football-data-adapter';

const LEAGUES = ['PL', 'BL1', 'PD', 'SA', 'FL1'];
const DELAY_MS = 7000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStandingsFromApi(): Promise<Standing[]> {
  const adapter = new HttpFootballDataAdapter();
  const all: Standing[] = [];
  for (const code of LEAGUES) {
    try {
      const rows = await adapter.fetchStandings(code);
      for (const row of rows) {
        all.push(
          Standing.create({
            externalTeamId: row.teamId,
            teamName: row.teamName,
            leagueCode: code,
            season: new Date().getFullYear(),
            position: row.position,
            playedGames: row.playedGames,
            won: row.won,
            draw: row.draw,
            lost: row.lost,
            points: row.points,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference,
            form: row.form,
            crestUrl: row.crestUrl,
          }),
        );
      }
    } catch (err) {
      console.error(`Error al obtener standings para ${code}:`, (err as Error).message);
    }
    await delay(DELAY_MS);
  }
  return all;
}

async function main(): Promise<void> {
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  const dbUrl = process.env.DATABASE_URL;

  if (!token) { console.error('Falta FOOTBALL_DATA_API_TOKEN en .env'); process.exit(1); }
  if (!dbUrl) { console.error('Falta DATABASE_URL en .env'); process.exit(1); }

  const dataSource = new DataSource({
    type: 'postgres',
    url: dbUrl,
    driver: pg,
    entities: [PlayerEntity, StandingEntity, TeamNameExceptionEntity, TeamEntity],
    synchronize: false,
  });

  await dataSource.initialize();

  try {
    const playerRepo = dataSource.getRepository(PlayerEntity);
    const exceptionRepo = dataSource.getRepository(TeamNameExceptionEntity);
    const teamRepo = dataSource.getRepository(TeamEntity);

    const [rawPlayers, rawExceptions] = await Promise.all([
      playerRepo
        .createQueryBuilder('p')
        .select('DISTINCT p.team', 'team')
        .where('p."removedAt" IS NULL')
        .getRawMany<{ team: string }>(),
      exceptionRepo.find(),
    ]);

    const distinctTeams = rawPlayers.map((r) => r.team).filter(Boolean);
    const exceptions = rawExceptions.map((e) =>
      TeamNameException.restore(e.id, {
        whoScoredRawName: e.whoScoredRawName,
        footballDataTeamId: e.footballDataTeamId,
        footballDataTeamName: e.footballDataTeamName,
        leagueCode: e.leagueCode,
      }),
    );

    console.log(`\nObteniendo standings de Football-Data para ${LEAGUES.length} ligas...`);
    const standings = await fetchStandingsFromApi();
    console.log(`Standings obtenidos: ${standings.length} equipos en total.\n`);

    let resolvedByNormalization = 0;
    let resolvedByException = 0;
    const unresolved: string[] = [];
    const teamsToUpsert: Partial<TeamEntity>[] = [];

    for (const teamName of distinctTeams) {
      const standing = resolveTeam(teamName, standings, exceptions);
      if (standing) {
        const usedException = exceptions.some((e) => e.whoScoredRawName === teamName);
        if (usedException) {
          resolvedByException++;
        } else {
          resolvedByNormalization++;
        }
        teamsToUpsert.push({
          whoScoredName: teamName,
          footballDataTeamId: standing.externalTeamId,
          footballDataTeamName: standing.teamName,
          leagueCode: standing.leagueCode,
          crestUrl: standing.crestUrl,
        });
      } else {
        unresolved.push(teamName);
      }
    }

    if (teamsToUpsert.length > 0) {
      await teamRepo.upsert(teamsToUpsert, ['whoScoredName']);
      console.log(`Upsert en tabla teams: ${teamsToUpsert.length} equipos.\n`);
    }

    const total = distinctTeams.length;
    console.log('=== Resumen de cobertura ===');
    console.log(`Total equipos evaluados : ${total}`);
    console.log(`Resueltos (normalización): ${resolvedByNormalization}`);
    console.log(`Resueltos (excepción)    : ${resolvedByException}`);
    console.log(`Sin resolver             : ${unresolved.length}`);
    if (total > 0) {
      const pct = (((resolvedByNormalization + resolvedByException) / total) * 100).toFixed(1);
      console.log(`Cobertura total          : ${pct}%`);
    }

    if (unresolved.length > 0) {
      const outPath = path.join(__dirname, '..', 'team_crosswalk_unresolved.txt');
      fs.writeFileSync(outPath, unresolved.join('\n') + '\n', 'utf8');
      console.log(`\nNombres sin resolver escritos en: ${outPath}`);
    } else {
      console.log('\nTodos los equipos resueltos.');
    }
  } finally {
    await dataSource.destroy();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});

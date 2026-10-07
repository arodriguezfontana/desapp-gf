/**
 * Script de crosswalk WhoScored ↔ Football-Data.
 * Resuelve los equipos de los jugadores contra los standings de Football-Data
 * y hace upsert en la tabla `teams` con el resultado.
 *
 * Uso: npm run seed:crosswalk (desde backend/)
 * Requiere en .env: DATABASE_URL, FOOTBALL_DATA_API_TOKEN
 */
import 'dotenv/config';
import axios from 'axios';
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

const LEAGUES = ['PL', 'BL1', 'PD', 'SA', 'FL1'];
const BASE_URL = 'https://api.football-data.org/v4';
const DELAY_MS = 7000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStandingsFromApi(token: string): Promise<Standing[]> {
  const all: Standing[] = [];
  for (const code of LEAGUES) {
    try {
      const response = await axios.get(
        `${BASE_URL}/competitions/${code}/standings`,
        { headers: { 'X-Auth-Token': token } },
      );
      const table = (response.data.standings as Array<{ type: string; table: Array<{ team: { id: number; name: string; crest?: string | null }; position: number; playedGames: number; won: number; draw: number; lost: number; points: number; goalsFor: number; goalsAgainst: number; goalDifference: number; form: string | null }> }>)?.find(
        (s) => s.type === 'TOTAL' || s.type === 'REGULAR_SEASON',
      );
      if (table) {
        for (const row of table.table) {
          all.push(
            Standing.create({
              externalTeamId: row.team.id,
              teamName: row.team.name,
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
              form: row.form ?? null,
              crestUrl: row.team.crest ?? null,
            }),
          );
        }
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
    const standings = await fetchStandingsFromApi(token);
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

import { Injectable, Logger, Optional } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  FootballDataAdapter,
  FootballDataMatchDTO,
  FootballDataStandingRowDTO,
} from './football-data-adapter';
import { RedisCacheService } from '../../shared/cache/redis-cache.service';

const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';
const EXTERNAL_CACHE_TTL_SECONDS = 604800; // 7 días

interface FootballDataStandingsTeam {
  id: number;
  name: string;
  crest?: string | null;
}

interface FootballDataStandingsTableRow {
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
  team: FootballDataStandingsTeam;
}

interface FootballDataStandingsBlock {
  type?: string;
  stage?: string;
  table: FootballDataStandingsTableRow[];
}

interface FootballDataStandingsResponse {
  standings: FootballDataStandingsBlock[];
}

interface FootballDataTeamRef {
  id: number;
  name: string;
}

interface FootballDataRawMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  season?: { id?: number };
  homeTeam: FootballDataTeamRef;
  awayTeam: FootballDataTeamRef;
  score?: {
    fullTime?: {
      home: number | null;
      away: number | null;
    };
  };
}

interface FootballDataMatchesResponse {
  matches: FootballDataRawMatch[];
}

@Injectable()
export class HttpFootballDataAdapter implements FootballDataAdapter {
  private readonly logger = new Logger(HttpFootballDataAdapter.name);
  private readonly httpClient: AxiosInstance;

  constructor(
    @Optional() httpClient?: AxiosInstance,
    @Optional() private readonly cache?: RedisCacheService,
  ) {
    this.httpClient =
      httpClient ||
      axios.create({
        baseURL: FOOTBALL_DATA_BASE_URL,
        timeout: 5000,
      });
  }

  private getHeaders(): Record<string, string> {
    const token = process.env.FOOTBALL_DATA_API_TOKEN;
    if (!token) {
      this.logger.warn('FOOTBALL_DATA_API_TOKEN is not defined in environment variables');
    }
    return {
      'X-Auth-Token': token || '',
    };
  }

  async fetchStandings(competitionCode: string): Promise<FootballDataStandingRowDTO[]> {
    const cacheKey = `futval:external:standings:${competitionCode}`;

    try {
      const response = await this.httpClient.get<FootballDataStandingsResponse>(
        `/competitions/${competitionCode}/standings`,
        { headers: this.getHeaders() },
      );

      const standingsData = response.data;
      if (!standingsData || !Array.isArray(standingsData.standings)) {
        return [];
      }

      const totalStanding =
        standingsData.standings.find(
          (s) => s.type === 'TOTAL' || s.stage === 'REGULAR_SEASON',
        ) || standingsData.standings[0];

      if (!totalStanding || !Array.isArray(totalStanding.table)) {
        return [];
      }

      const rows: FootballDataStandingRowDTO[] = totalStanding.table.map((row) => ({
        position: row.position,
        teamId: row.team.id,
        teamName: row.team.name,
        crestUrl: row.team.crest ? row.team.crest : null,
        playedGames: row.playedGames,
        form: row.form || null,
        won: row.won,
        draw: row.draw,
        lost: row.lost,
        points: row.points,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
      }));

      if (rows.length > 0 && this.cache) {
        await this.cache.set(cacheKey, rows, EXTERNAL_CACHE_TTL_SECONDS);
      }

      return rows;
    } catch (error) {
      this.logger.warn(
        `Fallo al consultar standings para ${competitionCode} en Football-Data (${error instanceof Error ? error.message : String(error)}). Activando fallback explícito.`,
      );

      if (this.cache) {
        const cached = await this.cache.get<FootballDataStandingRowDTO[]>(cacheKey);
        if (cached && cached.length > 0) {
          this.logger.log(`Fallback exitoso desde caché Redis para standings de ${competitionCode}`);
          return cached;
        }
      }

      return [];
    }
  }

  async fetchMatches(competitionCode: string): Promise<FootballDataMatchDTO[]> {
    const cacheKey = `futval:external:matches:${competitionCode}`;

    try {
      const response = await this.httpClient.get<FootballDataMatchesResponse>(
        `/competitions/${competitionCode}/matches`,
        { headers: this.getHeaders() },
      );

      const matchesData = response.data;
      if (!matchesData || !Array.isArray(matchesData.matches)) {
        return [];
      }

      const rows: FootballDataMatchDTO[] = matchesData.matches.map((m) => ({
        id: m.id,
        utcDate: m.utcDate,
        status: m.status,
        matchday: m.matchday,
        competitionCode: competitionCode,
        seasonYear: m.season?.id || new Date(m.utcDate).getFullYear(),
        homeTeamId: m.homeTeam.id,
        homeTeamName: m.homeTeam.name,
        awayTeamId: m.awayTeam.id,
        awayTeamName: m.awayTeam.name,
        homeScore: m.score?.fullTime?.home ?? null,
        awayScore: m.score?.fullTime?.away ?? null,
      }));

      if (rows.length > 0 && this.cache) {
        await this.cache.set(cacheKey, rows, EXTERNAL_CACHE_TTL_SECONDS);
      }

      return rows;
    } catch (error) {
      this.logger.warn(
        `Fallo al consultar matches para ${competitionCode} en Football-Data (${error instanceof Error ? error.message : String(error)}). Activando fallback explícito.`,
      );

      if (this.cache) {
        const cached = await this.cache.get<FootballDataMatchDTO[]>(cacheKey);
        if (cached && cached.length > 0) {
          this.logger.log(`Fallback exitoso desde caché Redis para matches de ${competitionCode}`);
          return cached;
        }
      }

      return [];
    }
  }
}

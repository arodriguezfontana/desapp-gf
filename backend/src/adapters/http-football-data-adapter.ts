import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  FootballDataAdapter,
  FootballDataMatchDTO,
  FootballDataStandingRowDTO,
} from './football-data-adapter';

const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

@Injectable()
export class HttpFootballDataAdapter implements FootballDataAdapter {
  private readonly logger = new Logger(HttpFootballDataAdapter.name);
  private readonly httpClient: AxiosInstance;

  constructor(httpClient?: AxiosInstance) {
    this.httpClient =
      httpClient ||
      axios.create({
        baseURL: FOOTBALL_DATA_BASE_URL,
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
    try {
      const response = await this.httpClient.get(
        `/competitions/${competitionCode}/standings`,
        { headers: this.getHeaders() },
      );

      const standingsData = response.data;
      if (!standingsData || !Array.isArray(standingsData.standings)) {
        return [];
      }

      const totalStanding = standingsData.standings.find(
        (s: any) => s.type === 'TOTAL' || s.stage === 'REGULAR_SEASON',
      ) || standingsData.standings[0];

      if (!totalStanding || !Array.isArray(totalStanding.table)) {
        return [];
      }

      return totalStanding.table.map((row: any): FootballDataStandingRowDTO => ({
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
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch standings for competition ${competitionCode}: ${error?.message || error}`,
      );
      throw error;
    }
  }

  async fetchMatches(competitionCode: string): Promise<FootballDataMatchDTO[]> {
    try {
      const response = await this.httpClient.get(
        `/competitions/${competitionCode}/matches`,
        { headers: this.getHeaders() },
      );

      const matchesData = response.data;
      if (!matchesData || !Array.isArray(matchesData.matches)) {
        return [];
      }

      return matchesData.matches.map((m: any): FootballDataMatchDTO => ({
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
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch matches for competition ${competitionCode}: ${error?.message || error}`,
      );
      throw error;
    }
  }
}


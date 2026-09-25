export interface FootballDataMatchDTO {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  competitionCode: string;
  seasonYear: number;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface FootballDataStandingRowDTO {
  position: number;
  teamId: number;
  teamName: string;
  crestUrl: string | null;
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface FootballDataAdapter {
  fetchMatches(competitionCode: string): Promise<FootballDataMatchDTO[]>;
  fetchStandings(competitionCode: string): Promise<FootballDataStandingRowDTO[]>;
}

export const FOOTBALL_DATA_ADAPTER = Symbol('FootballDataAdapter');


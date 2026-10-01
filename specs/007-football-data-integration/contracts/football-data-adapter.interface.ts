export interface RawFootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  competition: {
    code: string;
    name: string;
  };
  season: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
  homeTeam: {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  score: {
    winner: string | null;
    duration: string;
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface RawFootballDataStandingRow {
  position: number;
  team: {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  playedGames: number;
  form?: string;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface RawFootballDataStandingsResponse {
  filters: Record<string, any>;
  competition: {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string;
  };
  season: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
  standings: Array<{
    stage: string;
    type: string;
    group: string | null;
    table: RawFootballDataStandingRow[];
  }>;
}

export interface RawFootballDataMatchesResponse {
  filters: Record<string, any>;
  resultSet: {
    count: number;
    first: string;
    last: string;
    played: number;
  };
  competition: {
    id: number;
    name: string;
    code: string;
  };
  matches: RawFootballDataMatch[];
}

export interface FootballDataAdapter {
  fetchMatches(competitionCode: string): Promise<RawFootballDataMatch[]>;
  fetchStandings(competitionCode: string): Promise<RawFootballDataStandingRow[]>;
}


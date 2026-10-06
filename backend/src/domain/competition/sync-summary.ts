export interface LeagueSyncResult {
  leagueCode: string;
  standingsSynced: number;
  matchesSynced: number;
  failedSteps: ('standings' | 'matches')[];
}

export interface FootballDataSyncSummary {
  leagues: LeagueSyncResult[];
  failedLeagues: string[];
}

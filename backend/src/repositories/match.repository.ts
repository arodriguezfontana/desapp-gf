import { Match } from '../domain/match';

export interface MatchRepository {
  upsertMatches(matches: Match[]): Promise<void>;
  findByExternalId(externalId: number): Promise<Match | null>;
  findByLeagueCode(leagueCode: string): Promise<Match[]>;
}

export const MATCH_REPOSITORY = Symbol('MatchRepository');

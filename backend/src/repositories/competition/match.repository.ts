import { Match } from '../../domain/competition/match';

export interface MatchRepository {
  upsertMatches(matches: Match[]): Promise<void>;
  findByExternalId(externalId: number): Promise<Match | null>;
  findByLeagueCode(leagueCode: string): Promise<Match[]>;
}

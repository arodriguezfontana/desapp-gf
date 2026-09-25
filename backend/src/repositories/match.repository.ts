import { MatchEntity } from './entities/match.entity';

export interface MatchRepository {
  upsertMatches(matches: Partial<MatchEntity>[]): Promise<void>;
  findByExternalId(externalId: number): Promise<MatchEntity | null>;
  findByLeagueCode(leagueCode: string): Promise<MatchEntity[]>;
}

export const MATCH_REPOSITORY = Symbol('MatchRepository');


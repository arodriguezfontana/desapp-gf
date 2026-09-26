import { Standing } from '../domain/standing';

export interface StandingRepository {
  upsertStandings(standings: Standing[]): Promise<void>;
  findByTeamAndLeague(externalTeamId: number, leagueCode: string): Promise<Standing | null>;
  findByLeagueCode(leagueCode: string): Promise<Standing[]>;
}

export const STANDING_REPOSITORY = Symbol('StandingRepository');

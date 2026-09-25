import { StandingEntity } from './entities/standing.entity';

export interface StandingRepository {
  upsertStandings(standings: Partial<StandingEntity>[]): Promise<void>;
  findByTeamAndLeague(externalTeamId: number, leagueCode: string): Promise<StandingEntity | null>;
  findByLeagueCode(leagueCode: string): Promise<StandingEntity[]>;
}

export const STANDING_REPOSITORY = Symbol('StandingRepository');


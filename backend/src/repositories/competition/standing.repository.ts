import { Standing } from '../../domain/competition/standing';

export interface StandingRepository {
  upsertStandings(standings: Standing[]): Promise<void>;
  findByTeamAndLeague(externalTeamId: number, leagueCode: string): Promise<Standing | null>;
  findByLeagueCode(leagueCode: string): Promise<Standing[]>;
}

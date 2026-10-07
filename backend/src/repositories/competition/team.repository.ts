import { Team } from '../../domain/competition/team';

export interface TeamRepository {
  findByWhoScoredName(name: string): Promise<Team | null>;
  upsertTeams(teams: Team[]): Promise<void>;
}

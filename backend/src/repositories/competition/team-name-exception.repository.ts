import { TeamNameException } from '../../domain/competition/team-name-exception';

export interface TeamNameExceptionRepository {
  findAll(): Promise<TeamNameException[]>;
}

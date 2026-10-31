import { Injectable } from '@nestjs/common';
import { TeamNameException } from '../../../domain/competition/team-name-exception';
import { TeamNameExceptionEntity } from '../entities/team-name-exception.entity';

@Injectable()
export class TeamNameExceptionMapper {
  toDomain(entity: TeamNameExceptionEntity): TeamNameException {
    return TeamNameException.restore(entity.id, {
      whoScoredRawName: entity.whoScoredRawName,
      footballDataTeamId: entity.footballDataTeamId,
      footballDataTeamName: entity.footballDataTeamName,
      leagueCode: entity.leagueCode,
    });
  }
}

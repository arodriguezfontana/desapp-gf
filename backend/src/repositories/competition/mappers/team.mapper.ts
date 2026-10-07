import { Injectable } from '@nestjs/common';
import { Team } from '../../../domain/competition/team';
import { TeamEntity } from '../entities/team.entity';

@Injectable()
export class TeamMapper {
  toDomain(entity: TeamEntity): Team {
    return Team.restore(entity.id, {
      whoScoredName: entity.whoScoredName,
      footballDataTeamId: entity.footballDataTeamId,
      footballDataTeamName: entity.footballDataTeamName,
      leagueCode: entity.leagueCode,
      crestUrl: entity.crestUrl,
    });
  }

  toEntity(domain: Team): Partial<TeamEntity> {
    return {
      whoScoredName: domain.whoScoredName,
      footballDataTeamId: domain.footballDataTeamId,
      footballDataTeamName: domain.footballDataTeamName,
      leagueCode: domain.leagueCode,
      crestUrl: domain.crestUrl,
    };
  }
}

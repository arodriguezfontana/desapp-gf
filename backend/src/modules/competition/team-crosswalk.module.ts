import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamNameExceptionEntity } from '../../repositories/competition/entities/team-name-exception.entity';
import { TeamNameExceptionMapper } from '../../repositories/competition/mappers/team-name-exception.mapper';
import { TypeOrmTeamNameExceptionRepository } from '../../repositories/competition/typeorm-team-name-exception.repository';
import { TeamEntity } from '../../repositories/competition/entities/team.entity';
import { TeamMapper } from '../../repositories/competition/mappers/team.mapper';
import { TypeOrmTeamRepository } from '../../repositories/competition/typeorm-team.repository';
import { TEAM_NAME_EXCEPTION_REPOSITORY, TEAM_REPOSITORY } from './team-crosswalk.constants';

@Module({
  imports: [TypeOrmModule.forFeature([TeamNameExceptionEntity, TeamEntity])],
  providers: [
    TeamNameExceptionMapper,
    TeamMapper,
    {
      provide: TEAM_NAME_EXCEPTION_REPOSITORY,
      useClass: TypeOrmTeamNameExceptionRepository,
    },
    {
      provide: TEAM_REPOSITORY,
      useClass: TypeOrmTeamRepository,
    },
  ],
  exports: [TEAM_NAME_EXCEPTION_REPOSITORY, TEAM_REPOSITORY],
})
export class TeamCrosswalkModule {}

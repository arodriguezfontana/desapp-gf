import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamNameExceptionEntity } from '../../repositories/competition/entities/team-name-exception.entity';
import { TeamNameExceptionMapper } from '../../repositories/competition/mappers/team-name-exception.mapper';
import { TypeOrmTeamNameExceptionRepository } from '../../repositories/competition/typeorm-team-name-exception.repository';
import { TEAM_NAME_EXCEPTION_REPOSITORY } from './team-crosswalk.constants';

@Module({
  imports: [TypeOrmModule.forFeature([TeamNameExceptionEntity])],
  providers: [
    TeamNameExceptionMapper,
    {
      provide: TEAM_NAME_EXCEPTION_REPOSITORY,
      useClass: TypeOrmTeamNameExceptionRepository,
    },
  ],
  exports: [TEAM_NAME_EXCEPTION_REPOSITORY],
})
export class TeamCrosswalkModule {}

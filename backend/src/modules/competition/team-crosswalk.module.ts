import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamNameExceptionEntity } from '../../repositories/competition/entities/team-name-exception.entity';
import { TeamNameExceptionMapper } from '../../repositories/competition/mappers/team-name-exception.mapper';
import { TeamNameExceptionRepository } from '../../repositories/competition/team-name-exception.repository';
import { TeamEntity } from '../../repositories/competition/entities/team.entity';
import { TeamMapper } from '../../repositories/competition/mappers/team.mapper';
import { TeamRepository } from '../../repositories/competition/team.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TeamNameExceptionEntity, TeamEntity])],
  providers: [
    TeamNameExceptionMapper,
    TeamMapper,
    TeamNameExceptionRepository,
    TeamRepository,
  ],
  exports: [TeamNameExceptionRepository, TeamRepository],
})
export class TeamCrosswalkModule {}

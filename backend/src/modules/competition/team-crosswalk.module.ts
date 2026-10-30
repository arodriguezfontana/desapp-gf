import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamEntity } from '../../repositories/competition/entities/team.entity';
import { TeamMapper } from '../../repositories/competition/mappers/team.mapper';
import { TeamRepository } from '../../repositories/competition/team.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TeamEntity])],
  providers: [TeamMapper, TeamRepository],
  exports: [TeamRepository],
})
export class TeamCrosswalkModule {}

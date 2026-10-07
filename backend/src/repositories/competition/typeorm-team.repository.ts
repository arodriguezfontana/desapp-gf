import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../../domain/competition/team';
import { TeamEntity } from './entities/team.entity';
import { TeamMapper } from './mappers/team.mapper';
import { TeamRepository } from './team.repository';

@Injectable()
export class TypeOrmTeamRepository implements TeamRepository {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly repository: Repository<TeamEntity>,
    private readonly mapper: TeamMapper,
  ) {}

  async findByWhoScoredName(name: string): Promise<Team | null> {
    const entity = await this.repository.findOne({ where: { whoScoredName: name } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async upsertTeams(teams: Team[]): Promise<void> {
    if (teams.length === 0) return;
    const entities = teams.map((t) => this.mapper.toEntity(t));
    await this.repository.upsert(entities, ['whoScoredName']);
  }
}

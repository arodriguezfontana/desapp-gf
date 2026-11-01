import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Team } from '../../domain/competition/team';
import { TeamEntity } from './entities/team.entity';
import { TeamMapper } from './mappers/team.mapper';

@Injectable()
export class TeamRepository {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly repository: Repository<TeamEntity>,
    private readonly mapper: TeamMapper,
  ) {}

  async findByWhoScoredNames(names: string[]): Promise<Team[]> {
    const entities = await this.repository.find({ where: { whoScoredName: In(names) } });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async upsertTeams(teams: Team[]): Promise<void> {
    if (teams.length === 0) return;
    const entities = teams.map((t) => this.mapper.toEntity(t));
    await this.repository.upsert(entities, ['whoScoredName']);
  }
}

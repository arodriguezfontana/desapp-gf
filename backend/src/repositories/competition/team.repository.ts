import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async findByWhoScoredName(name: string): Promise<Team | null> {
    const entity = await this.repository.findOne({ where: { whoScoredName: name } });
    return entity ? this.mapper.toDomain(entity) : null;
  }
}

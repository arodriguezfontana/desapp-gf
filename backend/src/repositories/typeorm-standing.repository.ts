import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Standing } from '../domain/standing';
import { StandingEntity } from './entities/standing.entity';
import { StandingMapper } from './mappers/standing.mapper';
import { StandingRepository } from './standing.repository';

@Injectable()
export class TypeOrmStandingRepository implements StandingRepository {
  constructor(
    @InjectRepository(StandingEntity)
    private readonly repository: Repository<StandingEntity>,
    private readonly mapper: StandingMapper,
  ) {}

  async upsertStandings(standings: Standing[]): Promise<void> {
    if (!standings || standings.length === 0) {
      return;
    }
    const entities = standings.map((standing) => this.mapper.toEntity(standing));
    await this.repository.upsert(entities, ['externalTeamId', 'leagueCode']);
  }

  async findByTeamAndLeague(externalTeamId: number, leagueCode: string): Promise<Standing | null> {
    const entity = await this.repository.findOne({
      where: { externalTeamId, leagueCode },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByLeagueCode(leagueCode: string): Promise<Standing[]> {
    const entities = await this.repository.find({
      where: { leagueCode },
      order: { position: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }
}

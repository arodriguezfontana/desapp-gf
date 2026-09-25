import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from '../domain/match';
import { MatchEntity } from './entities/match.entity';
import { MatchMapper } from './mappers/match.mapper';
import { MatchRepository } from './match.repository';

@Injectable()
export class TypeOrmMatchRepository implements MatchRepository {
  constructor(
    @InjectRepository(MatchEntity)
    private readonly repository: Repository<MatchEntity>,
    private readonly mapper: MatchMapper,
  ) {}

  async upsertMatches(matches: Match[]): Promise<void> {
    if (!matches || matches.length === 0) {
      return;
    }
    const entities = matches.map((match) => this.mapper.toEntity(match));
    await this.repository.upsert(entities, ['externalId']);
  }

  async findByExternalId(externalId: number): Promise<Match | null> {
    const entity = await this.repository.findOne({
      where: { externalId },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByLeagueCode(leagueCode: string): Promise<Match[]> {
    const entities = await this.repository.find({
      where: { leagueCode },
      order: { utcDate: 'ASC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }
}

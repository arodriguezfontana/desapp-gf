import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchEntity } from './entities/match.entity';
import { MatchRepository } from './match.repository';

@Injectable()
export class TypeOrmMatchRepository implements MatchRepository {
  constructor(
    @InjectRepository(MatchEntity)
    private readonly repository: Repository<MatchEntity>,
  ) {}

  async upsertMatches(matches: Partial<MatchEntity>[]): Promise<void> {
    if (!matches || matches.length === 0) {
      return;
    }
    await this.repository.upsert(matches, ['externalId']);
  }

  async findByExternalId(externalId: number): Promise<MatchEntity | null> {
    return this.repository.findOne({
      where: { externalId },
    });
  }

  async findByLeagueCode(leagueCode: string): Promise<MatchEntity[]> {
    return this.repository.find({
      where: { leagueCode },
      order: { utcDate: 'ASC' },
    });
  }
}


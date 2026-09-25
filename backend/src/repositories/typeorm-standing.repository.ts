import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StandingEntity } from './entities/standing.entity';
import { StandingRepository } from './standing.repository';

@Injectable()
export class TypeOrmStandingRepository implements StandingRepository {
  constructor(
    @InjectRepository(StandingEntity)
    private readonly repository: Repository<StandingEntity>,
  ) {}

  async upsertStandings(standings: Partial<StandingEntity>[]): Promise<void> {
    if (!standings || standings.length === 0) {
      return;
    }
    await this.repository.upsert(standings, ['externalTeamId', 'leagueCode']);
  }

  async findByTeamAndLeague(externalTeamId: number, leagueCode: string): Promise<StandingEntity | null> {
    return this.repository.findOne({
      where: { externalTeamId, leagueCode },
    });
  }

  async findByLeagueCode(leagueCode: string): Promise<StandingEntity[]> {
    return this.repository.find({
      where: { leagueCode },
      order: { position: 'ASC' },
    });
  }
}


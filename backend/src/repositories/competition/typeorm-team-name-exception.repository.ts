import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamNameException } from '../../domain/competition/team-name-exception';
import { TeamNameExceptionEntity } from './entities/team-name-exception.entity';
import { TeamNameExceptionMapper } from './mappers/team-name-exception.mapper';
import { TeamNameExceptionRepository } from './team-name-exception.repository';

@Injectable()
export class TypeOrmTeamNameExceptionRepository
  implements TeamNameExceptionRepository
{
  constructor(
    @InjectRepository(TeamNameExceptionEntity)
    private readonly repository: Repository<TeamNameExceptionEntity>,
    private readonly mapper: TeamNameExceptionMapper,
  ) {}

  async findAll(): Promise<TeamNameException[]> {
    const entities = await this.repository.find();
    return entities.map((e) => this.mapper.toDomain(e));
  }
}

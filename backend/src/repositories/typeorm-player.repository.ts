import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Player } from '../domain/player/player';
import { PlayerFilters } from '../domain/player/player-filters';
import { PlayerPage, PlayerPagination } from '../domain/player/player-page';
import { PlayerEntity } from './entities/player.entity';
import { PlayerMapper } from './mappers/player.mapper';
import { PlayerRepository } from './player.repository';

@Injectable()
export class TypeOrmPlayerRepository implements PlayerRepository {
  constructor(
    @InjectRepository(PlayerEntity)
    private readonly repo: Repository<PlayerEntity>,
    private readonly mapper: PlayerMapper,
  ) {}

  async findPage(
    filters: PlayerFilters,
    pagination: PlayerPagination,
  ): Promise<PlayerPage> {
    const query = this.repo
      .createQueryBuilder('player')
      .orderBy('player.id', 'ASC');

    if (filters.league) {
      query.andWhere('player.league = :league', { league: filters.league });
    }
    if (filters.team) {
      query.andWhere('LOWER(player.team) = LOWER(:team)', {
        team: filters.team,
      });
    }
    if (filters.position) {
      query.andWhere('player.position = :position', {
        position: filters.position,
      });
    }

    const total = await query.getCount();
    const entities = await query
      .skip((pagination.page - 1) * pagination.pageSize)
      .take(pagination.pageSize)
      .getMany();

    return { items: entities.map((e) => this.mapper.toDomain(e)), total };
  }

  async findById(id: string): Promise<Player | null> {
    try {
      const entity = await this.repo.findOne({ where: { id } });
      return entity ? this.mapper.toDomain(entity) : null;
    } catch (error) {
      // Un id con formato inválido (no-uuid) no debe distinguirse de uno bien
      // formado pero inexistente (spec, Edge Cases): Postgres lo rechaza con
      // 22P02 (invalid_text_representation) antes de poder buscar la fila.
      if (
        error instanceof QueryFailedError &&
        (error as { driverError?: { code?: string } }).driverError?.code ===
          '22P02'
      ) {
        return null;
      }
      throw error;
    }
  }
}

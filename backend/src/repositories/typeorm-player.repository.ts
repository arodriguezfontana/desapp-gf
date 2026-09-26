import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { League } from '../domain/player/league';
import { Player } from '../domain/player/player';
import { PlayerFilters } from '../domain/player/player-filters';
import { PlayerPage, PlayerPagination } from '../domain/player/player-page';
import { PlayerSyncInput } from '../domain/player/player-sync-input';
import { isPostgresErrorCode } from '../shared/errors/postgres-error';
import { PlayerEntity } from './entities/player.entity';
import { PlayerMapper } from './mappers/player.mapper';
import { PlayerRepository } from './player.repository';

/**
 * Columnas que un upsert de sincronización sobrescribe en un conflicto de
 * `externalId` (006-whoscored-catalog-sync, data-model.md). `id` queda afuera
 * a propósito: en un conflicto, Postgres descarta el id recién generado y
 * conserva el id interno ya existente de esa fila — así el id del catálogo
 * se mantiene estable entre sincronizaciones (spec, Assumptions).
 */
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

const UPSERT_OVERWRITE_COLUMNS = [
  'name',
  'league',
  'team',
  'position',
  'passesCompleted',
  'shots',
  'interceptions',
  'rating',
  'removedAt',
];

@Injectable()
export class TypeOrmPlayerRepository implements PlayerRepository {
  constructor(
    @InjectRepository(PlayerEntity)
    private readonly repo: Repository<PlayerEntity>,
    private readonly mapper: PlayerMapper,
    private readonly dataSource: DataSource,
  ) {}

  async findPage(
    filters: PlayerFilters,
    pagination: PlayerPagination,
  ): Promise<PlayerPage> {
    const query = this.repo
      .createQueryBuilder('player')
      .where('player.removedAt IS NULL')
      .orderBy('player.id', 'ASC');

    if (filters.league) {
      query.andWhere('player.league = :league', { league: filters.league });
    }
    if (filters.team) {
      // Búsqueda parcial, insensible a mayúsculas/minúsculas (004-player-catalog,
      // Assumptions — actualizado: antes exigía el nombre completo exacto).
      query.andWhere('player.team ILIKE :team', { team: `%${filters.team}%` });
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
      const entity = await this.repo.findOne({
        where: { id, removedAt: IsNull() },
      });
      return entity ? this.mapper.toDomain(entity) : null;
    } catch (error) {
      // Un id con formato inválido (no-uuid) no debe distinguirse de uno bien
      // formado pero inexistente (spec, Edge Cases): Postgres lo rechaza con
      // 22P02 (invalid_text_representation) antes de poder buscar la fila.
      if (isPostgresErrorCode(error, PG_INVALID_TEXT_REPRESENTATION)) {
        return null;
      }
      throw error;
    }
  }

  async findActiveExternalIdsByTeam(
    league: League,
    team: string,
  ): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('player')
      .select('player.externalId', 'externalId')
      .where('player.league = :league', { league })
      .andWhere('player.team = :team', { team })
      .andWhere('player.removedAt IS NULL')
      .andWhere('player.externalId IS NOT NULL')
      .getRawMany<{ externalId: string }>();

    return rows.map((row) => row.externalId);
  }

  async applyTeamRosterSync(
    league: League,
    team: string,
    upserts: PlayerSyncInput[],
    removeExternalIds: string[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (upserts.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(PlayerEntity)
          .values(
            upserts.map((input) => ({
              id: randomUUID(),
              externalId: input.externalId,
              name: input.name,
              league,
              team,
              position: input.position,
              passesCompleted: input.metrics?.passesCompleted ?? null,
              shots: input.metrics?.shots ?? null,
              interceptions: input.metrics?.interceptions ?? null,
              rating: input.metrics?.rating ?? null,
              removedAt: null,
            })),
          )
          .orUpdate(UPSERT_OVERWRITE_COLUMNS, ['externalId'])
          .execute();
      }

      if (removeExternalIds.length > 0) {
        await manager.update(
          PlayerEntity,
          { externalId: In(removeExternalIds) },
          { removedAt: new Date() },
        );
      }
    });
  }
}

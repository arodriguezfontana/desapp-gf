import { League } from '../domain/player/league';
import { Player } from '../domain/player/player';
import { PlayerFilters } from '../domain/player/player-filters';
import { PlayerPage, PlayerPagination } from '../domain/player/player-page';
import { PlayerSyncInput } from '../domain/player/player-sync-input';

/**
 * Puerto de dominio para la persistencia de Player. Recibe y devuelve objetos de
 * dominio; el Service nunca ve la entidad de TypeORM. Token: PLAYER_REPOSITORY.
 *
 * El filtrado y la paginación se resuelven en la base (WHERE + LIMIT/OFFSET), no
 * cargando el catálogo completo en memoria (plan.md, decisión explícita).
 *
 * `findPage`/`findById` sólo devuelven jugadores vigentes (`removedAt IS
 * NULL` — 006-whoscored-catalog-sync, research.md §2): un jugador dado de
 * baja deja de listarse y `findById` lo trata como inexistente.
 */
export interface PlayerRepository {
  findPage(
    filters: PlayerFilters,
    pagination: PlayerPagination,
  ): Promise<PlayerPage>;
  findById(id: string): Promise<Player | null>;

  /**
   * Ids externos (WhoScored) de los jugadores hoy vigentes de ese equipo
   * (`removedAt IS NULL`). Usado por `PlayerSyncService` junto con
   * `computePlayersToRemove` para resolver el diff de altas/bajas de una
   * corrida (006-whoscored-catalog-sync, data-model.md).
   */
  findActiveExternalIdsByTeam(league: League, team: string): Promise<string[]>;

  /**
   * Aplica, en una única transacción, el resultado de sincronizar un equipo
   * puntual (research.md §1: "todo-o-nada" acotado a esta unidad): upsert por
   * `externalId` de `upserts` (reactivando `removedAt = NULL` si el jugador
   * había sido dado de baja antes) y baja lógica (`removedAt = now()`) de los
   * ids en `removeExternalIds`. No recalcula el diff: lo recibe ya resuelto.
   */
  applyTeamRosterSync(
    league: League,
    team: string,
    upserts: PlayerSyncInput[],
    removeExternalIds: string[],
  ): Promise<void>;
}

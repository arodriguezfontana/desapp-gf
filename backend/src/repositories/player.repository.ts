import { Player } from '../domain/player/player';
import { PlayerFilters } from '../domain/player/player-filters';
import { PlayerPage, PlayerPagination } from '../domain/player/player-page';

/**
 * Puerto de dominio para la persistencia de Player. Recibe y devuelve objetos de
 * dominio; el Service nunca ve la entidad de TypeORM. Token: PLAYER_REPOSITORY.
 *
 * El filtrado y la paginación se resuelven en la base (WHERE + LIMIT/OFFSET), no
 * cargando el catálogo completo en memoria (plan.md, decisión explícita).
 */
export interface PlayerRepository {
  findPage(
    filters: PlayerFilters,
    pagination: PlayerPagination,
  ): Promise<PlayerPage>;
  findById(id: string): Promise<Player | null>;
}

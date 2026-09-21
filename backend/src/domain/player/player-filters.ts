import { League } from './league';
import { Position } from './position';

/** Filtros combinables con AND para el listado del catálogo (FR-006). */
export interface PlayerFilters {
  league?: League;
  team?: string;
  position?: Position;
}

import { League } from './enums/league';
import { Position } from './enums/position';

/** Filtros combinables con AND para el listado del catálogo (FR-006). */
export interface PlayerFilters {
  league?: League;
  team?: string;
  position?: Position;
}

import { Player } from './player';

export interface PlayerPagination {
  page: number;
  pageSize: number;
}

/** Resultado paginado del listado (FR-007, FR-008): `total` no depende del tamaño de página. */
export interface PlayerPage {
  items: Player[];
  total: number;
}

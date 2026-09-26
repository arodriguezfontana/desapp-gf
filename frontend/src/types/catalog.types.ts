export type League = 'Premier League' | 'Bundesliga' | 'La Liga' | 'Serie A' | 'Ligue 1';
export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export interface Player {
  id: string;
  name: string;
  league: League | string;
  team: string;
  position: Position | string;
}

export interface PlayerListResponseDto {
  data: Player[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface CatalogFilters {
  league?: string;
  team?: string;
  position?: string;
}

export const LEAGUES: League[] = [
  'Premier League',
  'Bundesliga',
  'La Liga',
  'Serie A',
  'Ligue 1',
];

export const POSITIONS: Position[] = ['GK', 'DF', 'MF', 'FW'];

const POSITION_LABELS: Record<Position, string> = {
  GK: 'Arquero',
  DF: 'Defensor',
  MF: 'Mediocampista',
  FW: 'Delantero',
};

/** Nombre completo en español de una posición; si no es una de las 4 conocidas, la devuelve tal cual. */
export function getPositionLabel(position: string): string {
  return POSITION_LABELS[position as Position] ?? position;
}


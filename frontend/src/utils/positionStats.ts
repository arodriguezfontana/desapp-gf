import type { Player } from '../types/catalog.types';

export type StatKey =
  | 'goals'
  | 'assists'
  | 'keyPasses'
  | 'dribbles'
  | 'totalTackles'
  | 'shots'
  | 'passesCompleted'
  | 'interceptions'
  | 'rating'
  | 'yellowCards'
  | 'redCards';

/** `short` para la card del catálogo; `full` para la ficha del jugador. */
export const STAT_LABELS: Record<StatKey, { short: string; full: string }> = {
  goals: { short: 'Goles', full: 'Goles' },
  assists: { short: 'Asis.', full: 'Asistencias' },
  keyPasses: { short: 'P. clave', full: 'Pases clave' },
  dribbles: { short: 'Regates', full: 'Regates' },
  totalTackles: { short: 'Entradas', full: 'Entradas' },
  shots: { short: 'Remates', full: 'Remates' },
  passesCompleted: { short: 'Pases', full: 'Pases compl.' },
  interceptions: { short: 'Interc.', full: 'Intercepciones' },
  rating: { short: 'Rating', full: 'Rating' },
  yellowCards: { short: 'TA', full: 'Amarillas' },
  redCards: { short: 'TR', full: 'Rojas' },
};

/**
 * Las 3 estadísticas más significativas de cada posición: coinciden con las
 * métricas de mayor peso en los perfiles por posición de la estrategia por
 * defecto. `goals`, `assists`, `keyPasses`, `dribbles`, `totalTackles` y las
 * tarjetas son acumulados de temporada; `shots`, `passesCompleted`,
 * `interceptions` y `rating` son promedios por partido.
 */
const POSITION_STATS: Record<string, StatKey[]> = {
  FW: ['goals', 'assists', 'shots'],
  MF: ['assists', 'keyPasses', 'dribbles'],
  DF: ['totalTackles', 'interceptions', 'rating'],
  GK: ['rating', 'passesCompleted', 'interceptions'],
};

/** Posición desconocida: las estadísticas que se mostraban antes para todos. */
const DEFAULT_STATS: StatKey[] = ['goals', 'assists', 'yellowCards'];

/** Todas las estadísticas del jugador; las que no son principales van al bloque secundario de la ficha. */
const ALL_STATS: StatKey[] = [
  'goals',
  'assists',
  'keyPasses',
  'dribbles',
  'totalTackles',
  'shots',
  'passesCompleted',
  'interceptions',
  'rating',
  'yellowCards',
  'redCards',
];

/** Las 3 estadísticas más significativas de `position`, en el orden en que se muestran. */
export function getPositionStats(position: string): StatKey[] {
  return POSITION_STATS[position] ?? DEFAULT_STATS;
}

/** Las estadísticas que NO están entre las 3 principales de `position`. */
export function getSecondaryStats(position: string): StatKey[] {
  const main = getPositionStats(position);
  return ALL_STATS.filter((key) => !main.includes(key));
}

export function getStatValue(player: Player, key: StatKey): number | null | undefined {
  return player[key];
}

/** Enteros tal cual; promedios con un decimal; sin dato, "—". */
export function formatStat(value: number | null | undefined): string {
  if (value == null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

import { Position } from './position';

/**
 * Tabla de mapeo de posición fina de WhoScored al enum propio (GK/DF/MF/FW),
 * decisión de diseño fijada en la spec (006-whoscored-catalog-sync, Design
 * Decisions). Cualquier código fuera de esta tabla no matchea ninguna
 * categoría (FR-012): la política de excluir a ese jugador puntual y
 * loguearlo para revisión manual vive en `PlayerSyncService`, no acá.
 */
const WHOSCORED_POSITION_TABLE: ReadonlyMap<string, Position> = new Map([
  ['GK', Position.GK],

  ['DR', Position.DF],
  ['DC', Position.DF],
  ['DL', Position.DF],

  ['DMC', Position.MF],
  ['DM', Position.MF],
  ['MC', Position.MF],
  ['ML', Position.MF],
  ['MR', Position.MF],
  ['AMC', Position.MF],
  ['AML', Position.MF],
  ['AMR', Position.MF],

  ['FWR', Position.FW],
  ['FW', Position.FW],
  ['FWL', Position.FW],
]);

/**
 * Traduce un código de posición fino de WhoScored a una de las 4 posiciones
 * del enum propio. Pura, sin I/O.
 *
 * @returns la `Position` correspondiente, o `undefined` si `rawCode` no
 * matchea ninguna de las categorías de la tabla (FR-012).
 */
export function mapWhoScoredPosition(rawCode: string): Position | undefined {
  return WHOSCORED_POSITION_TABLE.get(rawCode);
}

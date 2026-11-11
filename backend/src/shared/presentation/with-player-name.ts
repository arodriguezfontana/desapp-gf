/** Objeto de dominio enriquecido con el nombre del jugador, resuelto al vuelo para la respuesta. */
export type WithPlayerName<T> = T & { playerName: string };

/**
 * Adjunta `playerName` a `entity` sin mutarla: devuelve un objeto nuevo que
 * delega en `entity` por prototipo, de modo que los getters y metodos del
 * dominio siguen funcionando y la entidad original queda intacta (el nombre es
 * un dato de presentacion, no parte del estado del dominio).
 */
export function withPlayerName<T extends object>(entity: T, playerName: string): WithPlayerName<T> {
  return Object.assign(Object.create(entity) as T, { playerName });
}

/**
 * Diferencia de conjuntos entre el plantel vigente de un equipo antes de una
 * corrida y el plantel recién scrapeado con éxito en esa corrida: los ids
 * externos (WhoScored) que estaban activos y ya no vienen en el plantel
 * entrante deben darse de baja lógica (FR-016).
 *
 * Pura, sin I/O. Es la lógica que define qué cambios forman la unidad
 * atómica de la sincronización de un equipo (constitución, Principio VI): el
 * dominio decide quién se da de baja, el repositorio sólo ejecuta la
 * escritura ya resuelta (`PlayerRepository.applyTeamRosterSync`).
 */
export function computePlayersToRemove(
  previouslyActiveExternalIds: string[],
  incomingExternalIds: string[],
): string[] {
  const incoming = new Set(incomingExternalIds);
  return previouslyActiveExternalIds.filter((id) => !incoming.has(id));
}

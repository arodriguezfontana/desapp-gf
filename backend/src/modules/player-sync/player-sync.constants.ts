/** Token de inyección del puerto de dominio para el scraping de WhoScored. */
export const WHOSCORED_ADAPTER = Symbol('WHOSCORED_ADAPTER');

/**
 * Timeout por request HTTP del Adapter hacia WhoScored (research.md §6 de
 * 006-whoscored-catalog-sync). Vencido el timeout, ese fetch se trata igual
 * que cualquier otro fallo de red en su nivel (liga/equipo/jugador).
 */
export const WHOSCORED_REQUEST_TIMEOUT_MS = 15_000;

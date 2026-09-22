import { League } from '../domain/player/league';

export interface WhoScoredTeamRef {
  externalTeamId: string;
  team: string;
}

export interface WhoScoredRawMetrics {
  passesCompleted: number;
  shots: number;
  interceptions: number;
  rating: number;
}

/**
 * Jugador crudo tal como lo devuelve WhoScored, con el código de posición
 * todavía SIN mapear (el mapeo al enum propio lo hace el dominio,
 * `mapWhoScoredPosition`, no el Adapter — research.md §3 de
 * 006-whoscored-catalog-sync).
 *
 * `metrics`/`metricsFetchFailed` distinguen dos casos que no son el mismo
 * (contracts/whoscored-adapter.md):
 * - `metrics: null, metricsFetchFailed: false` — se pudo leer la página de
 *   estadísticas, pero el jugador no registra partidos en la temporada en
 *   curso (legítimo, no se loguea para revisión manual).
 * - `metrics: null, metricsFetchFailed: true` — no se pudo obtener/parsear la
 *   página de estadísticas de ese jugador puntual (FR-018, sí se loguea).
 */
export interface WhoScoredRawPlayer {
  externalId: string;
  name: string;
  rawPosition: string;
  metrics: WhoScoredRawMetrics | null;
  metricsFetchFailed: boolean;
}

/**
 * Puerto de dominio hacia WhoScored (constitución, Principio I: única puerta
 * de entrada a este sistema externo). El Service nunca importa la librería de
 * scraping directo, siempre pasa por acá. Token: WHOSCORED_ADAPTER.
 */
export interface WhoScoredAdapter {
  /**
   * @throws si no se puede obtener la lista de equipos vigentes de la liga
   * (FR-014 nivel liga: `PlayerSyncService` saltea sólo esa liga en esa
   * corrida).
   */
  fetchLeagueTeams(league: League): Promise<WhoScoredTeamRef[]>;

  /**
   * Plantel completo del equipo, sin tope de cantidad (FR-005).
   *
   * @throws si no se puede obtener el plantel del equipo en sí (FR-014 nivel
   * equipo: `PlayerSyncService` saltea sólo ese equipo en esa corrida). Un
   * fallo puntual de la página de stats de un jugador NO debe propagarse como
   * excepción acá: se refleja como `metricsFetchFailed: true` en ese jugador.
   */
  fetchTeamRoster(team: WhoScoredTeamRef): Promise<WhoScoredRawPlayer[]>;
}

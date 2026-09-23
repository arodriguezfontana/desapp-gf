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
 * Resultado de resolver una liga: sus equipos vigentes, el `tournamentId` de
 * WhoScored de esa liga/temporada (para que quien orqueste pueda pasárselo
 * explícito a `fetchTeamRoster` sin que el Adapter tenga que recordarlo), y
 * el mapa de jugadores semilla por equipo (`externalTeamId → externalId de
 * un jugador conocido de ese equipo`, ver `fetchTeamRoster`).
 *
 * Todo esto viaja como valor de retorno — a propósito, no queda guardado en
 * ningún campo del Adapter — para que dos corridas de sincronización (del
 * scheduler, o dos `sync()` solapados) nunca puedan pisarse datos entre sí:
 * el Adapter no tiene estado propio entre llamadas (ver
 * `test/fixtures/whoscored/README.md` § "Limitación conocida" para el porqué
 * del jugador semilla).
 */
export interface WhoScoredLeagueTeams {
  tournamentId: number;
  teams: WhoScoredTeamRef[];
  seedPlayerByTeam: Map<string, string>;
}

/**
 * Puerto de dominio hacia WhoScored (constitución, Principio I: única puerta
 * de entrada a este sistema externo). El Service nunca importa la librería de
 * scraping directo, siempre pasa por acá. Token: WHOSCORED_ADAPTER.
 *
 * Sin estado compartido entre llamadas: todo lo que un método necesita de
 * una liga (su `tournamentId`, el jugador semilla de un equipo) se lo pasa
 * quien orquesta (`PlayerSyncService`) como parámetro explícito, nunca se
 * guarda en un campo de instancia del Adapter. Esto es lo que garantiza que
 * dos corridas —solapadas o no— nunca se pisen entre sí, incluso siendo el
 * Adapter un singleton de Nest.
 */
export interface WhoScoredAdapter {
  /**
   * @throws si no se puede obtener la lista de equipos vigentes de la liga
   * (FR-014 nivel liga: `PlayerSyncService` saltea sólo esa liga en esa
   * corrida).
   */
  fetchLeagueTeams(league: League): Promise<WhoScoredLeagueTeams>;

  /**
   * Plantel completo del equipo, sin tope de cantidad (FR-005).
   *
   * @param tournamentId el de la liga que se está sincronizando (de
   * `fetchLeagueTeams`), para tomar las métricas de la competencia correcta
   * y nunca mezclarlas con Champions League/copas.
   * @param seedPlayerId un jugador conocido de ese equipo (de
   * `WhoScoredLeagueTeams.seedPlayerByTeam`), usado para descubrir el
   * plantel completo vía su página (ver
   * `test/fixtures/whoscored/README.md`). Quien orquesta MUST verificar que
   * existe un jugador semilla para el equipo antes de llamar a este método.
   *
   * @throws si no se puede obtener el plantel del equipo en sí (FR-014 nivel
   * equipo: `PlayerSyncService` saltea sólo ese equipo en esa corrida). Un
   * fallo puntual de la página de stats de un jugador NO debe propagarse como
   * excepción acá: se refleja como `metricsFetchFailed: true` en ese jugador.
   */
  fetchTeamRoster(
    team: WhoScoredTeamRef,
    tournamentId: number,
    seedPlayerId: string,
  ): Promise<WhoScoredRawPlayer[]>;
}

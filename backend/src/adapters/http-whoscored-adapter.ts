import { Injectable, Logger } from '@nestjs/common';
import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import { League } from '../domain/player/league';
import { WHOSCORED_REQUEST_TIMEOUT_MS } from '../player-sync.constants';
import {
  WhoScoredAdapter,
  WhoScoredLeagueTeams,
  WhoScoredRawMetrics,
  WhoScoredRawPlayer,
  WhoScoredTeamRef,
} from './whoscored-adapter';

const BASE_URL = 'https://www.whoscored.com';

/**
 * Región/torneo de WhoScored por liga soportada — únicos ids que el dominio
 * no conoce (research.md §3 de 006-whoscored-catalog-sync). Verificados
 * contra el sitio real al escribir este Adapter (ver
 * `test/fixtures/whoscored/README.md`).
 */
const LEAGUE_CONFIG: Record<
  League,
  { regionId: number; tournamentId: number; slug: string }
> = {
  [League.PREMIER_LEAGUE]: {
    regionId: 252,
    tournamentId: 2,
    slug: 'england-premier-league',
  },
  [League.BUNDESLIGA]: {
    regionId: 81,
    tournamentId: 3,
    slug: 'germany-bundesliga',
  },
  [League.LA_LIGA]: { regionId: 206, tournamentId: 4, slug: 'spain-laliga' },
  [League.SERIE_A]: { regionId: 108, tournamentId: 5, slug: 'italy-serie-a' },
  [League.LIGUE_1]: { regionId: 74, tournamentId: 22, slug: 'france-ligue-1' },
};

interface WhoScoredTournamentSeasonStats {
  TournamentId: number;
  GameStarted: number;
  SubOn: number;
  TotalShots: number;
  AccuratePasses: number;
  Interceptions: number;
  Rating: number;
}

interface WhoScoredAssistDataEntry {
  TeamId: number;
  // No confirmado que WhoScored garantice un valor acá: un gol sin
  // asistencia real (jugada individual, penal, gol en contra) puede traer
  // 0/null/undefined en cualquiera de los dos ids. `isValidPlayerId` filtra
  // ambos casos antes de guardarlos como semilla.
  GSPlayerId: number | null | undefined;
  GAPlayerId: number | null | undefined;
}

/** `0`, `null`, `undefined` y `NaN` no son ids de jugador válidos. */
function isValidPlayerId(id: number | null | undefined): id is number {
  return typeof id === 'number' && id > 0;
}

/**
 * Implementación concreta del puerto `WhoScoredAdapter` (got-scraping +
 * cheerio, research.md §4 de 006-whoscored-catalog-sync). Única puerta de
 * entrada a WhoScored: `PlayerSyncService` no conoce nada de lo que hay acá.
 *
 * Deliberadamente sin campos de instancia mutables entre llamadas (más allá
 * del `logger`, que no participa de ningún dato de una corrida). Este
 * Adapter es un singleton de Nest: si `tournamentId` o el jugador semilla de
 * un equipo se guardaran en `this`, dos invocaciones de
 * `PlayerSyncService.sync()` — solapadas o no — podrían pisarse esos valores
 * entre sí (una corrida leyendo el `tournamentId` que otra corrida ya
 * sobreescribió). Por eso todo lo que un método necesita de una liga viaja
 * como parámetro explícito o como parte del valor de retorno de
 * `fetchLeagueTeams`, nunca como estado guardado acá.
 *
 * `gotScraping` (el cliente que importamos) también es un singleton de
 * módulo por diseño de la librería, pero no guarda nada por request que
 * pueda pisarse entre llamadas concurrentes (research.md §4 "Verificación de
 * statelessness"): no hay cookie jar salvo que se pase uno explícito (no lo
 * hacemos), y el único mecanismo de "sesión" de `got-scraping`
 * (`context.sessionToken`) es un no-op si no se pasa `context` (no lo
 * pasamos) — confirmado leyendo `got-scraping/dist/hooks/storage.js`.
 */
@Injectable()
export class HttpWhoScoredAdapter implements WhoScoredAdapter {
  private readonly logger = new Logger(HttpWhoScoredAdapter.name);

  async fetchLeagueTeams(league: League): Promise<WhoScoredLeagueTeams> {
    const config = LEAGUE_CONFIG[league];
    const url = `${BASE_URL}/regions/${config.regionId}/tournaments/${config.tournamentId}/${config.slug}`;
    const html = await this.get(url);
    const $ = cheerio.load(html);

    const teams = this.parseTeamsFromHtml($);
    if (teams.length === 0) {
      // `got-scraping` no lanza en un 403/bloqueo (`throwHttpErrors: false`,
      // a diferencia de `axios`): una página de liga bloqueada resuelve
      // igual, con HTML de error que no matchea ningún link de equipo. Sin
      // este chequeo, un bloqueo se leería como "esta liga no tiene equipos"
      // en vez de como el fallo de nivel liga que realmente es (FR-014).
      throw new Error(
        `La lista de equipos de ${league} vino vacía al parsear la página de la liga; probablemente cambió la estructura de la página o la request fue bloqueada. No se puede confiar en este resultado esta corrida.`,
      );
    }
    const seedPlayerByTeam = await this.harvestSeedPlayers($, league);

    return {
      tournamentId: config.tournamentId,
      teams,
      seedPlayerByTeam,
    };
  }

  /** Equipos vigentes de la liga a partir de los links `/teams/{id}/show/...` de la página. */
  private parseTeamsFromHtml($: cheerio.CheerioAPI): WhoScoredTeamRef[] {
    const teams = new Map<string, string>();
    $('a[href^="/teams/"][href*="/show/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = /^\/teams\/(\d+)\/show\//i.exec(href);
      const name = $(el).text().trim();
      if (match && name && !teams.has(match[1])) {
        teams.set(match[1], name);
      }
    });

    return [...teams.entries()].map(([externalTeamId, team]) => ({
      externalTeamId,
      team,
    }));
  }

  async fetchTeamRoster(
    team: WhoScoredTeamRef,
    tournamentId: number,
    seedPlayerId: string,
  ): Promise<WhoScoredRawPlayer[]> {
    const squad = await this.fetchSquadFromPlayerPage(seedPlayerId);
    if (squad.length === 0) {
      throw new Error(
        `El plantel de ${team.team} (${team.externalTeamId}) vino vacío al parsear la página del jugador semilla ${seedPlayerId}; probablemente cambió la estructura de la página. No se puede confiar en este resultado esta corrida.`,
      );
    }

    const players: WhoScoredRawPlayer[] = [];
    for (const member of squad) {
      const { metrics, metricsFetchFailed } = await this.fetchPlayerMetrics(
        member.externalId,
        member.slug,
        tournamentId,
      );
      players.push({
        externalId: member.externalId,
        name: member.name,
        rawPosition: member.rawPosition,
        metrics,
        metricsFetchFailed,
      });
    }
    return players;
  }

  /** Cosecha `teamId → jugador semilla` para esta liga a partir de `playerAssistData` (ver README de los fixtures). Devuelve el mapa; no guarda nada en `this`. */
  private async harvestSeedPlayers(
    $: cheerio.CheerioAPI,
    league: League,
  ): Promise<Map<string, string>> {
    const seedPlayerByTeam = new Map<string, string>();

    const statsHref = $('a[href*="playerstatistics"]').first().attr('href');
    if (!statsHref) {
      this.logger.warn(
        `No se encontró el link de estadísticas de jugadores para ${league}; sin jugadores semilla nuevos esta corrida.`,
      );
      return seedPlayerByTeam;
    }

    try {
      const html = await this.get(`${BASE_URL}${statsHref}`);
      const assistData = this.extractEmbeddedArray<WhoScoredAssistDataEntry>(
        html,
        'playerAssistData',
      );
      for (const entry of assistData) {
        // Sólo se guarda un id válido: si esta entrada trae un id inválido
        // (gol sin asistencia real, o un GSPlayerId ausente por lo que sea),
        // no se pisa una semilla válida que ya se hubiera guardado antes
        // para este mismo equipo (de esta entrada o de una anterior).
        if (isValidPlayerId(entry.GSPlayerId)) {
          seedPlayerByTeam.set(String(entry.TeamId), String(entry.GSPlayerId));
        }
        if (isValidPlayerId(entry.GAPlayerId)) {
          seedPlayerByTeam.set(String(entry.TeamId), String(entry.GAPlayerId));
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudieron cosechar jugadores semilla para ${league}: ${(error as Error).message}`,
      );
    }
    return seedPlayerByTeam;
  }

  /** Plantel completo (id, nombre, código de posición crudo) vía el `<select>` de navegación de la página de un jugador. */
  private async fetchSquadFromPlayerPage(playerId: string): Promise<
    Array<{ externalId: string; slug: string; name: string; rawPosition: string }>
  > {
    // El slug exacto no importa: WhoScored resuelve por id igual.
    const html = await this.get(`${BASE_URL}/players/${playerId}/show/player`);
    const $ = cheerio.load(html);

    const squad: Array<{
      externalId: string;
      slug: string;
      name: string;
      rawPosition: string;
    }> = [];

    $('#breadcrumb-nav select option').each((_, el) => {
      const value = $(el).attr('value') ?? '';
      const match = /^\/players\/(\d+)\/show\/(.+)$/i.exec(value);
      if (!match) return;

      const label = $(el).text().trim();
      const separatorIndex = label.lastIndexOf(' - ');
      if (separatorIndex === -1) return;

      const name = label.slice(0, separatorIndex).trim();
      const positionLabel = label.slice(separatorIndex + 3).trim();

      squad.push({
        externalId: match[1],
        slug: match[2],
        name,
        rawPosition: normalizeRawPosition(positionLabel),
      });
    });

    return squad;
  }

  /** Métricas de rendimiento de un jugador puntual, promedio por partido (FR-007). */
  private async fetchPlayerMetrics(
    externalId: string,
    slug: string,
    tournamentId: number,
  ): Promise<{ metrics: WhoScoredRawMetrics | null; metricsFetchFailed: boolean }> {
    try {
      const html = await this.get(
        `${BASE_URL}/players/${externalId}/matchstatistics/${slug}`,
      );
      const tournaments = this.extractEmbeddedArray<WhoScoredTournamentSeasonStats>(
        html,
        'tournaments',
      );

      // Sólo la competencia que se está sincronizando (nunca se mezcla con
      // Champions League, copas domésticas, selección, etc.). `tournamentId`
      // llega por parámetro explícito, no de un campo de instancia: dos
      // corridas de ligas distintas nunca se pueden pisar acá.
      const stats = tournaments.find(
        (t) =>
          t.TournamentId === tournamentId &&
          (t.GameStarted ?? 0) + (t.SubOn ?? 0) > 0,
      );
      if (!stats) {
        // Página leída bien: o el jugador no tiene fila para esta
        // competencia todavía, o no registra partidos jugados — en ambos
        // casos, legítimo, no es una falla (spec, Assumptions).
        return { metrics: null, metricsFetchFailed: false };
      }

      const appearances = stats.GameStarted + stats.SubOn;
      return {
        metrics: {
          passesCompleted: stats.AccuratePasses / appearances,
          shots: stats.TotalShots / appearances,
          interceptions: stats.Interceptions / appearances,
          rating: stats.Rating,
        },
        metricsFetchFailed: false,
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo obtener la página de estadísticas del jugador ${externalId}: ${(error as Error).message}`,
      );
      return { metrics: null, metricsFetchFailed: true };
    }
  }

  /** Busca `<script>` que declare `key: [...]` y devuelve ese array ya parseado. */
  private extractEmbeddedArray<T>(html: string, key: string): T[] {
    const marker = `${key}: [`;
    const start = html.indexOf(marker);
    if (start === -1) {
      throw new Error(`No se encontró el bloque embebido "${key}" en la página.`);
    }

    const arrayStart = start + marker.length - 1; // posición del '[' inicial
    let depth = 0;
    let end = -1;
    for (let i = arrayStart; i < html.length; i++) {
      if (html[i] === '[') depth++;
      else if (html[i] === ']') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) {
      throw new Error(`No se pudo determinar el cierre del array "${key}".`);
    }

    return JSON.parse(html.slice(arrayStart, end)) as T[];
  }

  /**
   * `got-scraping` (no `axios`, research.md §4): imita el ClientHello TLS, el
   * orden de headers y el fingerprint HTTP/2 de un navegador real —
   * `axios` usa el stack TLS plano de Node y Cloudflare lo bloquea (403) pese
   * a headers idénticos a los de un browser real (evidencia empírica en
   * research.md §4). No se fuerza un `User-Agent` fijo a mano: `got-scraping`
   * genera un set de headers consistente con el fingerprint TLS que negocia
   * (`header-generator`); pisar sólo el `User-Agent` rompería esa
   * consistencia y sería, en sí mismo, una señal más fácil de detectar.
   *
   * `got` expone `response.statusCode`/`response.body`, no
   * `response.status`/`response.data` como `axios` — no hay ningún chequeo
   * explícito de status acá (ni lo había con `axios`): un 403/500/lo que sea
   * no lanza por default (`throwHttpErrors` es `false` en `got-scraping`,
   * ver `got-scraping/dist/index.js`), así que un bloqueo se refleja como
   * HTML de error en `response.body`, no como excepción — lo cual el parseo
   * de más arriba ya trata como fallo igual (no encuentra el bloque
   * embebido esperado y tira `Error` en `extractEmbeddedArray`).
   */
  private async get(url: string): Promise<string> {
    const response = await gotScraping.get(url, {
      timeout: { request: WHOSCORED_REQUEST_TIMEOUT_MS },
    });
    return response.body;
  }
}

/**
 * Normaliza la notación compacta de WhoScored (p. ej. `D(CL)`, `M(CLR)`,
 * `AM(C)`) al código atómico que espera `mapWhoScoredPosition`: toma el
 * primer grupo de posición (antes de la primera coma — WhoScored lista la
 * posición principal primero) y, si tiene sub-posiciones entre paréntesis,
 * la primera de ellas. `GK`/`FW`/`DMC` (sin paréntesis) quedan como están.
 * Un valor que no matchea este patrón (p. ej. `Forward`, texto largo de
 * jugadores sin posición detallada todavía) se devuelve tal cual: no va a
 * matchear ninguna categoría de `mapWhoScoredPosition`, y por diseño ese
 * jugador queda excluido y logueado (FR-012) — no es responsabilidad de esta
 * normalización inventarle una categoría.
 */
export function normalizeRawPosition(label: string): string {
  const primaryGroup = label.split(',')[0]?.trim() ?? '';
  const match = /^([A-Z]+)(?:\(([A-Z]+)\))?$/.exec(primaryGroup);
  if (!match) return primaryGroup;

  const [, prefix, subPositions] = match;
  if (!subPositions) return prefix;
  return `${prefix}${subPositions[0]}`;
}

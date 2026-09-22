import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { League } from '../domain/player/league';
import { WHOSCORED_REQUEST_TIMEOUT_MS } from '../player-sync.constants';
import {
  WhoScoredAdapter,
  WhoScoredRawMetrics,
  WhoScoredRawPlayer,
  WhoScoredTeamRef,
} from './whoscored-adapter';

const BASE_URL = 'https://www.whoscored.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

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
  GSPlayerId: number;
  GAPlayerId: number;
}

/**
 * Implementación concreta del puerto `WhoScoredAdapter` (axios + cheerio,
 * research.md §4 de 006-whoscored-catalog-sync). Única puerta de entrada a
 * WhoScored: `PlayerSyncService` no conoce nada de lo que hay acá.
 */
@Injectable()
export class HttpWhoScoredAdapter implements WhoScoredAdapter {
  private readonly logger = new Logger(HttpWhoScoredAdapter.name);

  /**
   * `teamId → un jugador conocido de ese equipo`, harvesteado una vez por
   * liga en `fetchLeagueTeams` y consumido por `fetchTeamRoster` para
   * bootstrapear el descubrimiento del plantel (ver
   * `test/fixtures/whoscored/README.md` § "Limitación conocida": ni la
   * página de un equipo ni la de fixtures exponen estáticamente ningún id de
   * jugador; sólo la propia página de un jugador expone el plantel completo
   * de su equipo). Cobertura best-effort: un equipo sin semilla ese día no
   * se puede sincronizar esa corrida (FR-014, se trata como falla de ese
   * equipo, no bloquea al resto de la liga).
   */
  private readonly seedPlayerByTeam = new Map<string, string>();

  /**
   * `TournamentId` de WhoScored de la liga que se está sincronizando en este
   * momento, seteado por `fetchLeagueTeams` y leído por `fetchPlayerMetrics`
   * (invocado indirectamente desde `fetchTeamRoster`) para tomar las
   * métricas de la competencia correcta, nunca mezclar con Champions
   * League/copas — mismo criterio de estado-por-corrida que
   * `seedPlayerByTeam`. `PlayerSyncService` siempre llama
   * `fetchLeagueTeams(liga)` antes de `fetchTeamRoster(equipo)` para los
   * equipos de esa misma liga (ver `services/player-sync.service.ts`), así
   * que este valor es correcto en el momento en que se usa.
   */
  private currentTournamentId: number | null = null;

  async fetchLeagueTeams(league: League): Promise<WhoScoredTeamRef[]> {
    const config = LEAGUE_CONFIG[league];
    this.currentTournamentId = config.tournamentId;
    const url = `${BASE_URL}/regions/${config.regionId}/tournaments/${config.tournamentId}/${config.slug}`;
    const html = await this.get(url);
    const $ = cheerio.load(html);

    const teams = new Map<string, string>();
    $('a[href^="/teams/"][href*="/show/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = /^\/teams\/(\d+)\/show\//i.exec(href);
      const name = $(el).text().trim();
      if (match && name && !teams.has(match[1])) {
        teams.set(match[1], name);
      }
    });

    await this.harvestSeedPlayers($, league);

    return [...teams.entries()].map(([externalTeamId, team]) => ({
      externalTeamId,
      team,
    }));
  }

  async fetchTeamRoster(team: WhoScoredTeamRef): Promise<WhoScoredRawPlayer[]> {
    const seedPlayerId = this.seedPlayerByTeam.get(team.externalTeamId);
    if (!seedPlayerId) {
      throw new Error(
        `No se encontró un jugador semilla para el equipo ${team.team} (${team.externalTeamId}); no se puede descubrir su plantel esta corrida.`,
      );
    }

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

  /** Arma `seedPlayerByTeam` para esta liga a partir de `playerAssistData` (ver README de los fixtures). */
  private async harvestSeedPlayers(
    $: cheerio.CheerioAPI,
    league: League,
  ): Promise<void> {
    const statsHref = $('a[href*="playerstatistics"]').first().attr('href');
    if (!statsHref) {
      this.logger.warn(
        `No se encontró el link de estadísticas de jugadores para ${league}; sin jugadores semilla nuevos esta corrida.`,
      );
      return;
    }

    try {
      const html = await this.get(`${BASE_URL}${statsHref}`);
      const assistData = this.extractEmbeddedArray<WhoScoredAssistDataEntry>(
        html,
        'playerAssistData',
      );
      for (const entry of assistData) {
        this.seedPlayerByTeam.set(
          String(entry.TeamId),
          String(entry.GSPlayerId),
        );
        this.seedPlayerByTeam.set(
          String(entry.TeamId),
          String(entry.GAPlayerId),
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudieron cosechar jugadores semilla para ${league}: ${(error as Error).message}`,
      );
    }
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
      // Champions League, copas domésticas, selección, etc.).
      const stats = tournaments.find(
        (t) =>
          t.TournamentId === this.currentTournamentId &&
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

  private async get(url: string): Promise<string> {
    const response = await axios.get<string>(url, {
      timeout: WHOSCORED_REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      responseType: 'text',
    });
    return response.data;
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

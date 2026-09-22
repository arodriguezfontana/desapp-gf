import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WHOSCORED_ADAPTER } from '../player-sync.constants';
import { PLAYER_REPOSITORY } from '../player.constants';
import {
  WhoScoredAdapter,
  WhoScoredTeamRef,
} from '../adapters/whoscored-adapter';
import { League } from '../domain/player/league';
import { computePlayersToRemove } from '../domain/player/team-roster-sync';
import { mapWhoScoredPosition } from '../domain/player/whoscored-position-mapping';
import { PlayerSyncInput } from '../domain/player/player-sync-input';
import { PlayerRepository } from '../repositories/player.repository';

/**
 * Sincroniza el catálogo con datos reales de WhoScored (006-whoscored-catalog-sync).
 * No expuesto a clientes (FR-008, FR-017): sólo lo dispara el scheduler
 * (`@Cron`, ver `player-sync.module.ts`). Nunca lo importa `PlayerService`
 * ni `PlayerController` (verificado por `architecture.spec.ts`).
 *
 * Éxito/fracaso en tres niveles independientes, ninguno se propaga a los
 * demás (FR-014, research.md §1 — "todo-o-nada" acotado a la unidad que
 * falla, no a la corrida completa):
 * - **Liga**: si `fetchLeagueTeams` falla, se saltea sólo esa liga.
 * - **Equipo**: si no hay un jugador semilla conocido para el equipo, o si
 *   `fetchTeamRoster` falla, se saltea sólo ese equipo — el upsert/baja de
 *   ese equipo (`applyTeamRosterSync`) es una única transacción atómica
 *   (FR-016).
 * - **Jugador**: un código de posición no reconocido (FR-012/013) o una
 *   falla puntual de la página de estadísticas (FR-018) no hacen fallar a su
 *   equipo; ambos casos generan una entrada en el log de revisión manual,
 *   con motivos distintos (spec, Key Entities).
 */
@Injectable()
export class PlayerSyncService {
  private readonly logger = new Logger(PlayerSyncService.name);
  private readonly manualReviewLogger = new Logger('PlayerSyncManualReview');

  constructor(
    @Inject(WHOSCORED_ADAPTER) private readonly whoScored: WhoScoredAdapter,
    @Inject(PLAYER_REPOSITORY) private readonly players: PlayerRepository,
  ) {}

  /**
   * Frecuencia semanal (research.md §7 de 006-whoscored-catalog-sync).
   * `waitForCompletion: true` es defensa en profundidad, no la solución de
   * fondo: le pide al scheduler que nunca dispare una corrida nueva mientras
   * la anterior sigue corriendo. La solución de fondo es que
   * `HttpWhoScoredAdapter` ya no tiene ningún estado de instancia entre
   * corridas (`tournamentId`, el jugador semilla de un equipo viajan acá
   * como variables locales de esta misma invocación de `sync()`, nunca
   * guardados en el Adapter) — así que aunque dos corridas llegaran a
   * solaparse (dos instancias del scheduler, un `sync()` disparado a mano en
   * paralelo, etc.), no hay ningún dato compartido entre ellas que puedan
   * pisarse.
   */
  @Cron(CronExpression.EVERY_WEEK, { waitForCompletion: true })
  async sync(): Promise<void> {
    for (const league of Object.values(League)) {
      let leagueTeams: Awaited<ReturnType<WhoScoredAdapter['fetchLeagueTeams']>>;
      try {
        leagueTeams = await this.whoScored.fetchLeagueTeams(league);
      } catch (error) {
        this.logger.error(
          `No se pudo obtener la lista de equipos de ${league}; se saltea esta liga en esta corrida.`,
          error instanceof Error ? error.stack : String(error),
        );
        continue;
      }

      for (const team of leagueTeams.teams) {
        await this.syncTeam(
          league,
          team,
          leagueTeams.tournamentId,
          leagueTeams.seedPlayerByTeam,
        );
      }
    }
  }

  private async syncTeam(
    league: League,
    team: WhoScoredTeamRef,
    tournamentId: number,
    seedPlayerByTeam: Map<string, string>,
  ): Promise<void> {
    const seedPlayerId = seedPlayerByTeam.get(team.externalTeamId);
    if (!seedPlayerId) {
      this.logger.error(
        `No se encontró un jugador semilla para el equipo ${team.team} (${league}); se saltea este equipo en esta corrida.`,
      );
      return;
    }

    let roster: Awaited<ReturnType<WhoScoredAdapter['fetchTeamRoster']>>;
    try {
      roster = await this.whoScored.fetchTeamRoster(
        team,
        tournamentId,
        seedPlayerId,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo obtener el plantel de ${team.team} (${league}); se saltea este equipo en esta corrida.`,
        error instanceof Error ? error.stack : String(error),
      );
      return;
    }

    const upserts: PlayerSyncInput[] = [];
    for (const raw of roster) {
      const position = mapWhoScoredPosition(raw.rawPosition);
      if (!position) {
        // FR-012/FR-013: código de posición no reconocido, el jugador NO se
        // importa esta corrida; no cuenta como falla del equipo.
        this.manualReviewLogger.warn({
          reason: 'unrecognized-position',
          whoScoredPlayerId: raw.externalId,
          name: raw.name,
          team: team.team,
          league,
          rawPosition: raw.rawPosition,
        });
        continue;
      }

      if (raw.metricsFetchFailed) {
        // FR-018: falla técnica puntual en la página de stats del jugador;
        // SÍ se importa, con métricas en null; no cuenta como falla del equipo.
        this.manualReviewLogger.warn({
          reason: 'stats-fetch-failed',
          whoScoredPlayerId: raw.externalId,
          name: raw.name,
          team: team.team,
          league,
        });
      }

      upserts.push({
        externalId: raw.externalId,
        name: raw.name,
        position,
        metrics: raw.metrics,
      });
    }

    const activeExternalIds = await this.players.findActiveExternalIdsByTeam(
      league,
      team.team,
    );
    const removeExternalIds = computePlayersToRemove(
      activeExternalIds,
      upserts.map((u) => u.externalId),
    );

    await this.players.applyTeamRosterSync(
      league,
      team.team,
      upserts,
      removeExternalIds,
    );
  }
}

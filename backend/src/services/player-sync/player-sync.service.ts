import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { WHOSCORED_ADAPTER } from '../../modules/player-sync/player-sync.constants';
import { PLAYER_REPOSITORY } from '../../modules/player/player.constants';
import {
  WhoScoredAdapter,
  WhoScoredRawPlayer,
  WhoScoredTeamRef,
} from '../../adapters/player-sync/whoscored-adapter';
import { League } from '../../domain/player/enums/league';
import { computePlayersToRemove } from '../../domain/player/team-roster-sync';
import { mapWhoScoredPosition } from '../../domain/player/whoscored-position-mapping';
import { PlayerSyncInput } from '../../domain/player/player-sync-input';
import { PlayerRepository } from '../../repositories/player/player.repository';
import {
  SyncFailedUnit,
  SyncRunState,
  WhoScoredSyncSummary,
} from '../../domain/player/sync-run';
import { SyncInProgressError } from '../../domain/sync/errors/sync-in-progress.error';

const MAX_RETAINED_RUNS = 20;
const FATAL_ERROR_MESSAGE = 'La sincronización se interrumpió por un error inesperado.';

/**
 * Sincroniza el catálogo con datos reales de WhoScored (006-whoscored-catalog-sync).
 * Spec 009 agrega el disparo manual: `startManualRun()` / `getRun()`, lock en memoria
 * (`activeRunId`) y registro de corridas (`runs`). El método `sync()` del `@Cron` conserva
 * su firma `Promise<void>` para no romper los tests existentes.
 */
@Injectable()
export class PlayerSyncService {
  private readonly logger = new Logger(PlayerSyncService.name);
  private readonly manualReviewLogger = new Logger('PlayerSyncManualReview');

  private activeRunId: string | null = null;
  private readonly runs = new Map<string, SyncRunState>();

  constructor(
    @Inject(WHOSCORED_ADAPTER) private readonly whoScored: WhoScoredAdapter,
    @Inject(PLAYER_REPOSITORY) private readonly players: PlayerRepository,
  ) {}

  /**
   * Comprueba el lock y, si está libre, genera un runId, registra la corrida
   * y la arranca en background. Lanza `SyncInProgressError(activeRunId)` si el lock
   * ya está tomado.
   */
  startManualRun(): string {
    if (this.activeRunId !== null) {
      throw new SyncInProgressError(this.activeRunId);
    }
    const runId = randomUUID();
    this.activeRunId = runId;
    this.runs.set(runId, {
      runId,
      status: 'running',
      trigger: 'manual',
      startedAt: new Date(),
    });
    this.evictOldRuns();
    // Arrancar en background; el caller recibe el runId de inmediato.
    void this.runSyncAndRecord(runId, 'manual');
    return runId;
  }

  /** Devuelve el estado de una corrida, o undefined si no existe / fue descartada. */
  getRun(runId: string): SyncRunState | undefined {
    return this.runs.get(runId);
  }

  /**
   * Frecuencia semanal. Conserva la firma `Promise<void>` para no romper los tests
   * existentes (D1). Si el lock está tomado, loguea y retorna sin lanzar (FR-015).
   */
  @Cron(CronExpression.EVERY_WEEK, { waitForCompletion: true })
  async sync(): Promise<void> {
    if (this.activeRunId !== null) {
      this.logger.warn(
        'El @Cron de WhoScored se salta porque ya hay una corrida en curso (spec 009, FR-015).',
      );
      return;
    }
    const runId = randomUUID();
    this.activeRunId = runId;
    this.runs.set(runId, {
      runId,
      status: 'running',
      trigger: 'cron',
      startedAt: new Date(),
    });
    this.evictOldRuns();
    await this.runSyncAndRecord(runId, 'cron');
  }

  // ---- Lógica interna -------------------------------------------------------

  private async runSyncAndRecord(
    runId: string,
    trigger: 'manual' | 'cron',
  ): Promise<void> {
    const summary: WhoScoredSyncSummary = {
      teamsSynced: 0,
      playersSynced: 0,
      failedUnits: [],
    };
    try {
      await this.executeSync(summary);
      this.runs.set(runId, {
        runId,
        status: 'completed',
        trigger,
        startedAt: this.runs.get(runId)!.startedAt,
        finishedAt: new Date(),
        summary,
      });
    } catch (error) {
      this.logger.error(
        `Corrida ${runId} abortada por error inesperado.`,
        error instanceof Error ? error.stack : String(error),
      );
      this.runs.set(runId, {
        runId,
        status: 'failed',
        trigger,
        startedAt: this.runs.get(runId)!.startedAt,
        finishedAt: new Date(),
        summary,
        errorMessage: FATAL_ERROR_MESSAGE,
      });
    } finally {
      this.activeRunId = null;
    }
  }

  private async executeSync(summary: WhoScoredSyncSummary): Promise<void> {
    for (const league of Object.values(League)) {
      let leagueTeams: Awaited<ReturnType<WhoScoredAdapter['fetchLeagueTeams']>>;
      try {
        leagueTeams = await this.whoScored.fetchLeagueTeams(league); // NOSONAR
      } catch (error) {
        this.logger.error(
          `No se pudo obtener la lista de equipos de ${league}; se saltea esta liga en esta corrida.`,
          this.stackOf(error),
        );
        summary.failedUnits.push({ league, reason: 'league-fetch-failed' });
        continue;
      }

      for (const team of leagueTeams.teams) {
        const result = await this.syncTeam( // NOSONAR
          league,
          team,
          leagueTeams.tournamentId,
          leagueTeams.seedPlayerByTeam,
        );
        if (result.failed) {
          summary.failedUnits.push(result.failed);
        } else {
          summary.teamsSynced++;
          summary.playersSynced += result.playersSynced;
        }
      }
    }
  }

  private async syncTeam(
    league: League,
    team: WhoScoredTeamRef,
    tournamentId: number,
    seedPlayerByTeam: Map<string, string>,
  ): Promise<{ failed?: SyncFailedUnit; playersSynced: number }> {
    const seedPlayerId = seedPlayerByTeam.get(team.externalTeamId);
    if (!seedPlayerId) {
      this.logger.error(
        `No se encontró un jugador semilla para el equipo ${team.team} (${league}); se saltea este equipo en esta corrida.`,
      );
      return { failed: { league, team: team.team, reason: 'no-seed-player' }, playersSynced: 0 };
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
        this.stackOf(error),
      );
      return { failed: { league, team: team.team, reason: 'roster-fetch-failed' }, playersSynced: 0 };
    }

    const upserts = this.buildSyncInputs(roster, team, league);

    const activeExternalIds = await this.players.findActiveExternalIdsByTeam(
      league,
      team.team,
    );
    const removeExternalIds = computePlayersToRemove(
      activeExternalIds,
      upserts.map((input) => input.externalId),
    );

    await this.players.applyTeamRosterSync(
      league,
      team.team,
      upserts,
      removeExternalIds,
    );

    return { playersSynced: upserts.length };
  }

  private buildSyncInputs(
    roster: WhoScoredRawPlayer[],
    team: WhoScoredTeamRef,
    league: League,
  ): PlayerSyncInput[] {
    const upserts: PlayerSyncInput[] = [];

    for (const raw of roster) {
      const position = mapWhoScoredPosition(raw.rawPosition);
      if (!position) {
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

    return upserts;
  }

  private evictOldRuns(): void {
    if (this.runs.size <= MAX_RETAINED_RUNS) return;
    // Descartar la entrada terminada más vieja (nunca la que está running)
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    for (const [key, state] of this.runs) {
      if (state.status !== 'running' && state.startedAt.getTime() < oldestTime) {
        oldestTime = state.startedAt.getTime();
        oldestKey = key;
      }
    }
    if (oldestKey) this.runs.delete(oldestKey);
  }

  private stackOf(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : String(error);
  }
}

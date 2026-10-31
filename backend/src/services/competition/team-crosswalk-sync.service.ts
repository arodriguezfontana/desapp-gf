import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { resolveTeam } from '../../domain/competition/resolve-team';
import { Team } from '../../domain/competition/team';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { StandingRepository } from '../../repositories/competition/standing.repository';
import { TeamNameExceptionRepository } from '../../repositories/competition/team-name-exception.repository';
import { TeamRepository } from '../../repositories/competition/team.repository';

/** Domingos a las 06:00: despues de los crons semanales de WhoScored y Football-Data (domingos a las 00:00). */
export const TEAM_CROSSWALK_CRON = '0 6 * * 0';

export interface TeamCrosswalkSummary {
  resolved: number;
  unresolved: string[];
}

/**
 * Mantiene la tabla `teams` (crosswalk WhoScored ↔ Football-Data, 010-team-name-crosswalk)
 * sin llamar a ninguna API externa: cruza los equipos de los jugadores ya sincronizados
 * contra las standings ya sincronizadas, con `resolveTeam`.
 */
@Injectable()
export class TeamCrosswalkSyncService {
  private readonly logger = new Logger(TeamCrosswalkSyncService.name);
  private isRunning = false;

  constructor(
    private readonly players: PlayerRepository,
    private readonly standings: StandingRepository,
    private readonly exceptions: TeamNameExceptionRepository,
    private readonly teams: TeamRepository,
  ) {}

  /**
   * Si una corrida anterior sigue en curso se salta esta ejecucion. Un error inesperado
   * se registra y no se propaga al scheduler, igual que en los otros crons de sync.
   */
  @Cron(TEAM_CROSSWALK_CRON, { waitForCompletion: true })
  async handleCron(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('El @Cron del crosswalk de equipos se salta porque ya hay una corrida en curso.');
      return;
    }
    this.isRunning = true;
    try {
      await this.sync();
    } catch (error) {
      this.logger.error(
        'El crosswalk de equipos fallo con un error inesperado.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  async sync(): Promise<TeamCrosswalkSummary> {
    const [teamNames, standings, exceptions] = await Promise.all([
      this.players.findActiveTeamNames(),
      this.standings.findAll(),
      this.exceptions.findAll(),
    ]);

    const resolvedTeams: Team[] = [];
    const unresolved: string[] = [];

    for (const teamName of teamNames) {
      const standing = resolveTeam(teamName, standings, exceptions);
      if (standing) {
        resolvedTeams.push(
          Team.create({
            whoScoredName: teamName,
            footballDataTeamId: standing.externalTeamId,
            footballDataTeamName: standing.teamName,
            leagueCode: standing.leagueCode,
            crestUrl: standing.crestUrl,
          }),
        );
      } else {
        unresolved.push(teamName);
      }
    }

    await this.teams.upsertTeams(resolvedTeams);

    this.logger.log(`Crosswalk de equipos: ${resolvedTeams.length} resueltos, ${unresolved.length} sin resolver.`);
    if (unresolved.length > 0) {
      this.logger.warn(
        `Equipos sin resolver (agregar una excepcion en team_name_exception): ${unresolved.join(', ')}`,
      );
    }

    return { resolved: resolvedTeams.length, unresolved };
  }
}

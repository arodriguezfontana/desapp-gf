import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FOOTBALL_DATA_ADAPTER, FootballDataAdapter } from '../adapters/football-data-adapter';
import { MATCH_REPOSITORY, MatchRepository } from '../repositories/match.repository';
import { STANDING_REPOSITORY, StandingRepository } from '../repositories/standing.repository';
import { classifyMatchStatus } from '../domain/match-status-classifier';
import { Match } from '../domain/match';
import { Standing } from '../domain/standing';

export const TARGET_LEAGUES = ['PL', 'BL1', 'PD', 'SA', 'FL1'];

@Injectable()
export class FootballDataSyncService {
  private readonly logger = new Logger(FootballDataSyncService.name);
  private requestDelayMs = 7000;

  constructor(
    @Inject(FOOTBALL_DATA_ADAPTER)
    private readonly adapter: FootballDataAdapter,
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepository: MatchRepository,
    @Inject(STANDING_REPOSITORY)
    private readonly standingRepository: StandingRepository,
  ) {}

  public setRequestDelay(ms: number): void {
    this.requestDelayMs = ms;
  }

  private async delay(): Promise<void> {
    if (this.requestDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.requestDelayMs));
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async handleCron(): Promise<void> {
    this.logger.log('Starting scheduled Football-Data synchronization...');
    await this.syncAllLeagues();
    this.logger.log('Scheduled Football-Data synchronization finished.');
  }

  async syncAllLeagues(): Promise<void> {
    for (const leagueCode of TARGET_LEAGUES) {
      await this.syncStandingsForLeague(leagueCode);
      await this.delay();

      await this.syncMatchesForLeague(leagueCode);
      await this.delay();
    }
  }

  async syncStandingsForLeague(leagueCode: string): Promise<void> {
    try {
      this.logger.log(`Fetching standings for league ${leagueCode}...`);
      const rows = await this.adapter.fetchStandings(leagueCode);

      if (rows.length === 0) {
        this.logger.log(`No standings data received for league ${leagueCode}`);
        return;
      }

      const currentYear = new Date().getFullYear();
      const standings: Standing[] = rows.map((row) =>
        Standing.create({
          externalTeamId: row.teamId,
          teamName: row.teamName,
          leagueCode: leagueCode,
          season: currentYear,
          position: row.position,
          playedGames: row.playedGames,
          won: row.won,
          draw: row.draw,
          lost: row.lost,
          points: row.points,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          form: row.form,
          crestUrl: row.crestUrl,
        }),
      );

      await this.standingRepository.upsertStandings(standings);
      this.logger.log(`Successfully synchronized ${standings.length} standings for ${leagueCode}`);
    } catch (error: any) {
      this.logger.error(
        `Error synchronizing standings for league ${leagueCode}: ${error?.message || error}`,
      );
    }
  }

  async syncMatchesForLeague(leagueCode: string): Promise<void> {
    try {
      this.logger.log(`Fetching matches for league ${leagueCode}...`);
      const rawMatches = await this.adapter.fetchMatches(leagueCode);

      if (rawMatches.length === 0) {
        this.logger.log(`No matches data received for league ${leagueCode}`);
        return;
      }

      const matches: Match[] = [];

      for (const m of rawMatches) {
        const classification = classifyMatchStatus(m.status);
        if (!classification.persist || !classification.classification) {
          continue;
        }

        matches.push(
          Match.create({
            externalId: m.id,
            leagueCode: leagueCode,
            season: m.seasonYear,
            matchday: m.matchday,
            utcDate: new Date(m.utcDate),
            status: m.status,
            classification: classification.classification,
            homeTeamId: m.homeTeamId,
            homeTeamName: m.homeTeamName,
            awayTeamId: m.awayTeamId,
            awayTeamName: m.awayTeamName,
            homeScore: classification.includeScore ? m.homeScore : null,
            awayScore: classification.includeScore ? m.awayScore : null,
          }),
        );
      }

      if (matches.length > 0) {
        await this.matchRepository.upsertMatches(matches);
        this.logger.log(
          `Successfully synchronized ${matches.length} matches (filtered from ${rawMatches.length}) for ${leagueCode}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Error synchronizing matches for league ${leagueCode}: ${error?.message || error}`,
      );
    }
  }
}


import { Inject, Injectable } from '@nestjs/common';
import {
  STANDING_REPOSITORY,
  TEAM_NAME_EXCEPTION_REPOSITORY,
} from '../../modules/player/player-enrichment.constants';
import { Player } from '../../domain/player/player';
import { League } from '../../domain/player/enums/league';
import { PlayerFilters } from '../../domain/player/player-filters';
import { PlayerPagination } from '../../domain/player/player-page';
import { StandingRepository } from '../../repositories/competition/standing.repository';
import { TeamNameExceptionRepository } from '../../repositories/competition/team-name-exception.repository';
import { resolveTeam } from '../../domain/competition/resolve-team';
import { PlayerService } from './player.service';

const LEAGUE_TO_CODE: Record<League, string> = {
  [League.PREMIER_LEAGUE]: 'PL',
  [League.BUNDESLIGA]: 'BL1',
  [League.LA_LIGA]: 'PD',
  [League.SERIE_A]: 'SA',
  [League.LIGUE_1]: 'FL1',
};

export interface PlayerWithCrest {
  player: Player;
  crestUrl: string | null;
}

export interface PlayerPageWithCrests {
  items: PlayerWithCrest[];
  total: number;
}

@Injectable()
export class PlayerEnrichmentService {
  constructor(
    private readonly playerService: PlayerService,
    @Inject(STANDING_REPOSITORY) private readonly standings: StandingRepository,
    @Inject(TEAM_NAME_EXCEPTION_REPOSITORY)
    private readonly teamNameExceptions: TeamNameExceptionRepository,
  ) {}

  async listPlayersWithCrests(
    filters: PlayerFilters,
    pagination: PlayerPagination,
  ): Promise<PlayerPageWithCrests> {
    const page = await this.playerService.listPlayers(filters, pagination);
    const crestMap = await this.resolveCrests(page.items);
    return {
      items: page.items.map((player) => ({
        player,
        crestUrl: crestMap.get(player.id) ?? null,
      })),
      total: page.total,
    };
  }

  async getPlayerByIdWithCrest(id: string): Promise<PlayerWithCrest> {
    const player = await this.playerService.getPlayerById(id);
    const leagueCode = LEAGUE_TO_CODE[player.league];
    const [standings, exceptions] = await Promise.all([
      this.standings.findByLeagueCode(leagueCode),
      this.teamNameExceptions.findAll(),
    ]);
    const standing = resolveTeam(player.team, standings, exceptions);
    return { player, crestUrl: standing?.crestUrl ?? null };
  }

  private async resolveCrests(players: Player[]): Promise<Map<string, string | null>> {
    if (players.length === 0) return new Map();

    const leagues = [...new Set(players.map((p) => LEAGUE_TO_CODE[p.league]).filter(Boolean))];
    const [allStandings, exceptions] = await Promise.all([
      Promise.all(leagues.map((code) => this.standings.findByLeagueCode(code))).then(
        (arrays) => arrays.flat(),
      ),
      this.teamNameExceptions.findAll(),
    ]);

    const crestMap = new Map<string, string | null>();
    for (const player of players) {
      const leagueCode = LEAGUE_TO_CODE[player.league];
      const leagueStandings = allStandings.filter((s) => s.leagueCode === leagueCode);
      const standing = resolveTeam(player.team, leagueStandings, exceptions);
      crestMap.set(player.id, standing?.crestUrl ?? null);
    }
    return crestMap;
  }
}

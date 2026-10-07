import { Inject, Injectable } from '@nestjs/common';
import { TEAM_REPOSITORY } from '../../modules/player/player-enrichment.constants';
import { Player } from '../../domain/player/player';
import { PlayerFilters } from '../../domain/player/player-filters';
import { PlayerPagination } from '../../domain/player/player-page';
import { TeamRepository } from '../../repositories/competition/team.repository';
import { PlayerService } from './player.service';

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
    @Inject(TEAM_REPOSITORY) private readonly teams: TeamRepository,
  ) {}

  async listPlayersWithCrests(
    filters: PlayerFilters,
    pagination: PlayerPagination,
  ): Promise<PlayerPageWithCrests> {
    const page = await this.playerService.listPlayers(filters, pagination);
    const items = await Promise.all(
      page.items.map(async (player) => ({
        player,
        crestUrl: await this.resolveCrest(player),
      })),
    );
    return { items, total: page.total };
  }

  async getPlayerByIdWithCrest(id: string): Promise<PlayerWithCrest> {
    const player = await this.playerService.getPlayerById(id);
    return { player, crestUrl: await this.resolveCrest(player) };
  }

  private async resolveCrest(player: Player): Promise<string | null> {
    const team = await this.teams.findByWhoScoredName(player.team);
    return team?.crestUrl ?? null;
  }
}

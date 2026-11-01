import { Injectable } from '@nestjs/common';
import { Player } from '../../domain/player/player';
import { PlayerNotFoundError } from '../../domain/player/errors/player-not-found.error';
import { PlayerFilters } from '../../domain/player/player-filters';
import { PlayerPage, PlayerPagination } from '../../domain/player/player-page';
import { PlayerRankingPage, PlayerRepository } from '../../repositories/player/player.repository';

@Injectable()
export class PlayerService {
  constructor(
    private readonly players: PlayerRepository,
  ) {}

  async listPlayers(
    filters: PlayerFilters,
    pagination: PlayerPagination,
  ): Promise<PlayerPage> {
    return this.players.findPage(filters, pagination);
  }

  async findRanking(
    userId: string,
    filters: PlayerFilters,
    pagination: PlayerPagination,
  ): Promise<PlayerRankingPage> {
    return this.players.findRanking(userId, filters, pagination);
  }

  /** @throws PlayerNotFoundError si no existe ningún jugador con ese id (FR-010) */
  async getPlayerById(id: string): Promise<Player> {
    const player = await this.players.findById(id);
    if (!player) {
      throw new PlayerNotFoundError();
    }
    return player;
  }
}

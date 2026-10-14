import { ApiProperty } from '@nestjs/swagger';
import { PlayerRankingResponseDto } from './player-ranking-response.dto';
import { PlayerRankingPageWithCrests } from '../../../domain/player/player-ranking';
import { PlayerPagination } from '../../../domain/player/player-page';

export class PlayerRankingListResponseDto {
  @ApiProperty({ type: [PlayerRankingResponseDto] })
  items: PlayerRankingResponseDto[];

  @ApiProperty({
    example: 150,
    description:
      'Total de jugadores cotizados que cumplen los filtros, sin paginar.',
  })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  constructor(
    items: PlayerRankingResponseDto[],
    total: number,
    page: number,
    pageSize: number,
  ) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.pageSize = pageSize;
  }

  static fromDomain(
    page: PlayerRankingPageWithCrests,
    pagination: PlayerPagination,
  ): PlayerRankingListResponseDto {
    const items = page.items.map((item) =>
      PlayerRankingResponseDto.fromRankedPlayerWithCrest(item),
    );
    return new PlayerRankingListResponseDto(
      items,
      page.total,
      pagination.page,
      pagination.pageSize,
    );
  }
}


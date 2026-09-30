import { ApiProperty } from '@nestjs/swagger';
import { PlayerPage } from '../../../domain/player/player-page';
import { PlayerResponseDto } from './player-response.dto';

export class PlayerListResponseDto {
  @ApiProperty({ type: [PlayerResponseDto] })
  items: PlayerResponseDto[];

  @ApiProperty({ example: 20, description: 'Total de resultados que cumplen los filtros, sin paginar.' })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  private constructor(
    items: PlayerResponseDto[],
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
    result: PlayerPage,
    page: number,
    pageSize: number,
  ): PlayerListResponseDto {
    return new PlayerListResponseDto(
      result.items.map((player) => PlayerResponseDto.fromDomain(player)),
      result.total,
      page,
      pageSize,
    );
  }
}

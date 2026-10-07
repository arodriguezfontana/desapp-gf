import { ApiProperty } from '@nestjs/swagger';
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

  constructor(
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
}

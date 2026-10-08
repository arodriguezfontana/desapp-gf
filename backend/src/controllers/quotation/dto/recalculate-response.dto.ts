import { ApiProperty } from '@nestjs/swagger';

export class RecalculateResponseDto {
  @ApiProperty({ description: 'Jugadores para los que se calculó y persistió una cotización' })
  processedPlayers!: number;

  @ApiProperty({ description: 'Jugadores que fallaron durante el cálculo' })
  errors!: number;

  @ApiProperty({ description: 'Duración total del recálculo en milisegundos' })
  durationMs!: number;
}

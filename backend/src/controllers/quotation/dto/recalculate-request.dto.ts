import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class RecalculateRequestDto {
  @ApiPropertyOptional({
    description: 'Id del jugador puntual a recalcular. Si se omite, se recalcula todo el catálogo.',
  })
  @IsOptional()
  @IsUUID()
  playerId?: string;
}

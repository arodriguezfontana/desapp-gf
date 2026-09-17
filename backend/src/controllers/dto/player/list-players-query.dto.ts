import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * `league`/`position` quedan como `string` simple, sin `@IsEnum()`: su membresía
 * en el enum de dominio se valida en el Controller (`parseLeague`/`parsePosition`),
 * no acá (pedido explícito del usuario para posición, extendido a liga por
 * simetría — research.md §4 de 004-player-catalog). `page`/`pageSize` sí son
 * validación de forma (Principio III) y quedan en el DTO.
 */
export class ListPlayersQueryDto {
  @ApiPropertyOptional({ example: 'La Liga' })
  @IsOptional()
  @IsString()
  league?: string;

  @ApiPropertyOptional({ example: 'CD Montebravo' })
  @IsOptional()
  @IsString()
  team?: string;

  @ApiPropertyOptional({ example: 'GK' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 10;
}

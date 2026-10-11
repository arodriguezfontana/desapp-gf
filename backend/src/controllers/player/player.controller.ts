import { Controller, Get, HttpStatus, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { Public } from '../../guards/public.decorator';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';
import { parseLeague } from '../../domain/player/enums/league';
import { parsePosition } from '../../domain/player/enums/position';
import { PlayerFilters } from '../../domain/player/player-filters';
import { PlayerEnrichmentService } from '../../services/player/player-enrichment.service';
import { QuotationService } from '../../services/quotation/quotation.service';
import { ListPlayersQueryDto } from './dto/list-players-query.dto';
import { PlayerListResponseDto } from './dto/player-list-response.dto';
import { PlayerResponseDto } from './dto/player-response.dto';
import { PlayerQuoteDetailResponseDto } from './dto/player-quote-detail-response.dto';
import { ParseDatePipe } from './pipes/parse-date.pipe';

/**
 * Catálogo de jugadores (datos de prueba). Protegido con ApiKey, no con JWT
 * (constitución, Principio IV — ver spec § Design Decisions y plan.md § Constitution
 * Check): `@Public()` lo exime del `JwtAuthGuard` global, `ApiKeyGuard` es el único
 * mecanismo de autenticación que exige.
 */
@ApiTags('players')
@ApiSecurity('ApiKeyAuth')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('players')
export class PlayerController {
  constructor(
    private readonly players: PlayerEnrichmentService,
    private readonly quotationService: QuotationService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista el catálogo de jugadores de prueba, con filtros y paginación',
  })
  @ApiResponse({ status: 200, type: PlayerListResponseDto })
  @ApiResponse({ status: 400, description: 'Filtro o paginación inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async list(
    @Query() query: ListPlayersQueryDto,
  ): Promise<PlayerListResponseDto> {
    const filters: PlayerFilters = {
      league: query.league ? parseLeague(query.league) : undefined,
      team: query.team,
      position: query.position ? parsePosition(query.position) : undefined,
    };

    const result = await this.players.listPlayersWithCrests(filters, {
      page: query.page,
      pageSize: query.pageSize,
    });

    return new PlayerListResponseDto(
      result.items.map(({ player, crestUrl }) =>
        PlayerResponseDto.fromDomain(player, crestUrl),
      ),
      result.total,
      query.page,
      query.pageSize,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un jugador puntual del catálogo de prueba' })
  @ApiResponse({ status: 200, type: PlayerResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'No existe un jugador con ese id.' })
  async detail(@Param('id') id: string): Promise<PlayerResponseDto> {
    const { player, crestUrl } = await this.players.getPlayerByIdWithCrest(id);
    return PlayerResponseDto.fromDomain(player, crestUrl);
  }

  @Get(':id/quote')
  @ApiOperation({
    summary: 'Cotización vigente o histórica de un jugador',
    description:
      'Devuelve el valor del token, score normalizado, snapshot de pesos y estrategia aplicada. Si "at" está presente, devuelve la cotización vigente al final de ese día UTC (23:59:59.999Z). Si "at" está ausente, devuelve la última cotización sin restricción de fecha. Retorna 204 si el jugador existe pero no tiene cotizaciones para esa fecha.',
  })
  @ApiQuery({
    name: 'at',
    required: false,
    description: 'Fecha en formato ISO 8601 (ej. 2026-09-15)',
    type: String,
  })
  @ApiResponse({ status: 200, type: PlayerQuoteDetailResponseDto })
  @ApiResponse({ status: 204, description: 'El jugador no posee cotización calculada para esa fecha.' })
  @ApiResponse({ status: 400, description: 'Formato de fecha "at" inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'No existe un jugador con ese id (PLAYER_NOT_FOUND).' })
  async quote(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Query('at', ParseDatePipe) at?: Date,
  ): Promise<PlayerQuoteDetailResponseDto | void> {
    const result = await this.quotationService.getQuoteAtDate(id, at);
    if (!result) {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    return PlayerQuoteDetailResponseDto.fromDomain(result.quote, result.strategyName);
  }
}

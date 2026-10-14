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
import { PlayerRankingListResponseDto } from './dto/player-ranking-list-response.dto';
import { PlayerResponseDto } from './dto/player-response.dto';
import { PlayerQuoteDetailResponseDto } from './dto/player-quote-detail-response.dto';
import { PlayerQuoteResponseDto } from '../quotation/dto/player-quote-response.dto';
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

  @Get('ranking')
  @ApiOperation({
    summary:
      'Ranking de jugadores ordenados descendentemente por su cotización vigente',
    description:
      'Retorna el listado de jugadores ordenados por valor desc, score desc, id asc bajo la estrategia activa o más reciente. Solo incluye jugadores con cotizaciones calculadas.',
  })
  @ApiQuery({
    name: 'league',
    required: false,
    description: 'Filtrar por liga (Premier League, Bundesliga, La Liga, Serie A, Ligue 1)',
    type: String,
  })
  @ApiQuery({
    name: 'position',
    required: false,
    description: 'Filtrar por posición táctica (GK, DF, MF, FW)',
    type: String,
  })
  @ApiQuery({
    name: 'team',
    required: false,
    description: 'Filtrar por coincidencia parcial en nombre del equipo',
    type: String,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página solicitada (mínimo 1)',
    type: Number,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Cantidad de elementos por página (1..50)',
    type: Number,
  })
  @ApiResponse({ status: 200, type: PlayerRankingListResponseDto })
  @ApiResponse({ status: 400, description: 'Filtro o paginación inválidos.' })
  @ApiResponse({ status: 401, description: 'API key inválida o ausente.' })
  async ranking(
    @Query() query: ListPlayersQueryDto,
  ): Promise<PlayerRankingListResponseDto> {
    const filters: PlayerFilters = {
      league: query.league ? parseLeague(query.league) : undefined,
      team: query.team,
      position: query.position ? parsePosition(query.position) : undefined,
    };

    const result = await this.players.getRankingWithCrests(filters, {
      page: query.page,
      pageSize: query.pageSize,
    });

    return PlayerRankingListResponseDto.fromDomain(result, {
      page: query.page,
      pageSize: query.pageSize,
    });
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

  @Get(':id/quotes')
  @ApiOperation({
    summary: 'Historial completo de cotizaciones de un jugador',
    description:
      'Devuelve todas las cotizaciones calculadas para el jugador, ordenadas de la más antigua a la más reciente. Si el jugador existe pero no tiene cotizaciones todavía, devuelve un array vacío (200), no 404.',
  })
  @ApiResponse({ status: 200, type: [PlayerQuoteResponseDto] })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'No existe un jugador con ese id (PLAYER_NOT_FOUND).' })
  async quotes(@Param('id') id: string): Promise<PlayerQuoteResponseDto[]> {
    const history = await this.quotationService.getQuoteHistory(id);
    return history.map((quote) => PlayerQuoteResponseDto.fromDomain(quote));
  }
}

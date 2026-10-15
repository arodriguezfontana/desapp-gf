import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { Public } from '../../guards/public.decorator';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';
import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { parseLeague } from '../../domain/player/enums/league';
import { parsePosition } from '../../domain/player/enums/position';
import { PlayerFilters } from '../../domain/player/player-filters';
import { PlayerEnrichmentService } from '../../services/player/player-enrichment.service';
import { QuotationService } from '../../services/quotation/quotation.service';
import { ListPlayersQueryDto } from './dto/list-players-query.dto';
import { PlayerListResponseDto } from './dto/player-list-response.dto';
import { PlayerRankingListResponseDto } from './dto/player-ranking-list-response.dto';
import { PlayerResponseDto } from './dto/player-response.dto';
import { PlayerValuationQueryDto } from './dto/player-valuation-query.dto';
import { PlayerValuationResponseDto } from './dto/player-valuation-response.dto';
import { PlayerQuoteResponseDto } from '../quotation/dto/player-quote-response.dto';

/**
 * Catálogo de jugadores (datos de prueba). El listado, el ranking y el
 * detalle quedan protegidos con ApiKey, no con JWT (constitución, Principio
 * IV — ver spec 012 § Design Decisions): `@Public()` + `ApiKeyGuard` a nivel
 * de método exime esos endpoints del `JwtAuthGuard` global.
 *
 * `:id/valuation` y `:id/quotes` son operaciones ligadas a un usuario
 * individual (019-per-user-valuation-strategies, spec Assumptions): exigen
 * JWT, por eso NO llevan `@Public()`/`ApiKeyGuard` y quedan bajo el
 * `JwtAuthGuard` global por defecto.
 */
@ApiTags('players')
@Controller('players')
export class PlayerController {
  constructor(
    private readonly players: PlayerEnrichmentService,
    private readonly quotationService: QuotationService,
  ) {}

  @Get()
  @Public()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('ApiKeyAuth')
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
  @Public()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('ApiKeyAuth')
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
  @Public()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('ApiKeyAuth')
  @ApiOperation({ summary: 'Detalle de un jugador puntual del catálogo de prueba' })
  @ApiResponse({ status: 200, type: PlayerResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'No existe un jugador con ese id.' })
  async detail(@Param('id') id: string): Promise<PlayerResponseDto> {
    const { player, crestUrl } = await this.players.getPlayerByIdWithCrest(id);
    return PlayerResponseDto.fromDomain(player, crestUrl);
  }

  @Get(':id/valuation')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cuánto valdría este jugador según mi estrategia',
    description:
      'Calcula al vuelo el valor del jugador con mi estrategia seleccionada, o con la indicada por query si es una de mis dos estrategias propias. No persiste ningún registro (019-per-user-valuation-strategies, spec FR-010/FR-011).',
  })
  @ApiQuery({
    name: 'strategyId',
    required: false,
    description: 'Id de una de mis dos estrategias propias, para usar en este cálculo puntual en lugar de la seleccionada',
    type: String,
  })
  @ApiResponse({ status: 200, type: PlayerValuationResponseDto })
  @ApiResponse({ status: 403, description: 'strategyId indicado no pertenece al usuario autenticado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'No existe un jugador con ese id.' })
  async valuation(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Query() query: PlayerValuationQueryDto,
  ): Promise<PlayerValuationResponseDto> {
    const result = await this.quotationService.valuate(userId, id, query.strategyId);
    return PlayerValuationResponseDto.fromResult(result);
  }

  @Get(':id/quotes')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mi historial de cotizaciones de un jugador',
    description:
      'Devuelve las cotizaciones que yo mismo generé con mis recálculos para este jugador, ordenadas de la más antigua a la más reciente. Nunca incluye cotizaciones de otro usuario. Si todavía no recalculé este jugador, devuelve un array vacío (200), no 404 (019-per-user-valuation-strategies, spec FR-017/FR-018/FR-019).',
  })
  @ApiResponse({ status: 200, type: [PlayerQuoteResponseDto] })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'No existe un jugador con ese id (PLAYER_NOT_FOUND).' })
  async quotes(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ): Promise<PlayerQuoteResponseDto[]> {
    const history = await this.quotationService.getQuoteHistory(userId, id);
    return history.map((quote) => PlayerQuoteResponseDto.fromDomain(quote));
  }
}

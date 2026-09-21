import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { Public } from '../guards/public.decorator';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { parseLeague } from '../domain/player/league';
import { parsePosition } from '../domain/player/position';
import { PlayerFilters } from '../domain/player/player-filters';
import { PlayerService } from '../services/player.service';
import { ListPlayersQueryDto } from './dto/player/list-players-query.dto';
import { PlayerListResponseDto } from './dto/player/player-list-response.dto';
import { PlayerResponseDto } from './dto/player/player-response.dto';

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
  constructor(private readonly players: PlayerService) {}

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

    const result = await this.players.listPlayers(filters, {
      page: query.page,
      pageSize: query.pageSize,
    });

    return PlayerListResponseDto.fromDomain(result, query.page, query.pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un jugador puntual del catálogo de prueba' })
  @ApiResponse({ status: 200, type: PlayerResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'No existe un jugador con ese id.' })
  async detail(@Param('id') id: string): Promise<PlayerResponseDto> {
    const player = await this.players.getPlayerById(id);
    return PlayerResponseDto.fromDomain(player);
  }
}

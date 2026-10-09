import { Controller, Get, HttpCode, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from '../../guards/public.decorator';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';
import { AdminApiKeyGuard } from '../../guards/api-key/admin-api-key.guard';
import { QuotationService } from '../../services/quotation/quotation.service';
import { PlayerQuoteResponseDto } from './dto/player-quote-response.dto';
import { RecalculateResponseDto } from './dto/recalculate-response.dto';
import { StrategyResponseDto } from './dto/strategy-response.dto';

@ApiTags('quotes')
@Public()
@Controller('quotes')
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Get('player/:playerId')
  @Public()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('ApiKeyAuth')
  @ApiOperation({
    summary: 'Última cotización calculada para un jugador',
    description: 'Devuelve el valor del token y el score del último recálculo para el jugador. 404 si el jugador no tiene cotizaciones todavía.',
  })
  @ApiResponse({ status: 200, type: PlayerQuoteResponseDto })
  @ApiResponse({ status: 404, description: 'No hay cotización para este jugador' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getLatestQuote(@Param('playerId') playerId: string): Promise<PlayerQuoteResponseDto> {
    const quote = await this.quotationService.getLatestQuoteByPlayerId(playerId);
    if (!quote) {
      throw new NotFoundException(`No hay cotización disponible para el jugador '${playerId}'.`);
    }
    return PlayerQuoteResponseDto.fromDomain(quote);
  }

  @Patch('strategies/:id/activate')
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activar una estrategia de valuación',
    description: 'Requiere ApiKey de admin. Desactiva la estrategia activa actual y activa la indicada. El próximo recálculo usará esta estrategia.',
  })
  @ApiResponse({ status: 200, type: StrategyResponseDto })
  @ApiResponse({ status: 404, description: 'Estrategia no encontrada' })
  async activateStrategy(@Param('id') id: string): Promise<StrategyResponseDto> {
    const strategy = await this.quotationService.activateStrategy(id);
    return StrategyResponseDto.fromDomain(strategy);
  }

  @Post('recalculate')
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Recalcular cotizaciones de todos los jugadores activos',
    description:
      'Requiere ApiKey de admin. Calcula y persiste una PlayerQuote por cada jugador activo usando la estrategia activa. Devuelve 409 si ya hay un recálculo en curso.',
  })
  @ApiResponse({ status: 200, type: RecalculateResponseDto })
  @ApiResponse({ status: 409, description: 'Recálculo ya en curso' })
  @ApiResponse({ status: 422, description: 'No hay estrategia activa' })
  async recalculate(): Promise<RecalculateResponseDto> {
    return this.quotationService.recalculateAll();
  }
}

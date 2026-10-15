import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { QuotationService } from '../../services/quotation/quotation.service';
import { RecalculateRequestDto } from './dto/recalculate-request.dto';
import { RecalculateResponseDto } from './dto/recalculate-response.dto';

/**
 * Recálculo manual de cotizaciones, por usuario (019-per-user-valuation-strategies,
 * reemplaza el job semanal global y el endpoint admin de
 * 012-valuation-strategies). Bajo JwtAuthGuard (global): es una operación
 * ligada a un usuario individual, no una operación de sistema (constitución,
 * Principio IV).
 */
@ApiTags('quotes')
@ApiBearerAuth()
@Controller('users/me/quotes')
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Post('recalculate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recalcular mis cotizaciones',
    description:
      'Recalcula y persiste cotizaciones usando mi estrategia seleccionada en este momento. Sin playerId, procesa todo el catálogo (salteando jugadores cuyo cálculo falle); con playerId, procesa solo ese jugador (rechaza todo si falla). Síncrono: la respuesta llega después de terminar.',
  })
  @ApiResponse({ status: 200, type: RecalculateResponseDto })
  @ApiResponse({ status: 404, description: 'playerId indicado no existe' })
  @ApiResponse({ status: 409, description: 'Ya hay un recálculo propio en curso' })
  @ApiResponse({ status: 422, description: 'Falló el cálculo del playerId puntual indicado' })
  async recalculate(
    @CurrentUser() userId: string,
    @Body() body: RecalculateRequestDto,
  ): Promise<RecalculateResponseDto> {
    const result = await this.quotationService.recalculate(userId, body.playerId);
    return RecalculateResponseDto.fromDomain(result);
  }
}

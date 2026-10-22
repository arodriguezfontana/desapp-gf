import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { AlertsService } from '../../services/alerts/alerts.service';
import { CreatePriceAlertRequestDto } from './dto/create-price-alert-request.dto';
import { PriceAlertResponseDto } from './dto/price-alert-response.dto';

/**
 * Controller de alertas de precio (025-player-price-alerts, contracts/alerts-api.md).
 * Protegido por el JwtAuthGuard global — todos sus endpoints son user-scoped.
 */
@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Crea una alerta de precio propia sobre un jugador existente.' })
  @ApiResponse({ status: 201, type: PriceAlertResponseDto })
  @ApiResponse({ status: 400, description: 'Umbral no positivo o condición inválida.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 404, description: 'El jugador indicado no existe.' })
  async create(
    @CurrentUser() userId: string,
    @Body() dto: CreatePriceAlertRequestDto,
  ): Promise<PriceAlertResponseDto> {
    const alert = await this.alertsService.create(userId, dto.playerId, dto.condition, dto.targetValue);
    return PriceAlertResponseDto.fromDomain(alert);
  }

  @Get()
  @ApiOperation({ summary: 'Lista las alertas propias del usuario autenticado (activas y canceladas).' })
  @ApiResponse({ status: 200, type: [PriceAlertResponseDto] })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async list(@CurrentUser() userId: string): Promise<PriceAlertResponseDto[]> {
    const alerts = await this.alertsService.listOwn(userId);
    return alerts.map((alert) => PriceAlertResponseDto.fromDomain(alert));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancela una alerta propia; deja de evaluarse en recálculos futuros.' })
  @ApiParam({ name: 'id', description: 'ID de la alerta (UUID)', type: String })
  @ApiResponse({ status: 204, description: 'Alerta cancelada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 404, description: 'La alerta no existe o no pertenece al usuario autenticado.' })
  async cancel(@CurrentUser() userId: string, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.alertsService.cancel(userId, id);
  }
}

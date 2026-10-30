import { Body, Controller, Get, HttpCode, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../guards/auth/current-user.decorator';
import { parsePosition } from '../../domain/player/enums/position';
import { StrategyService } from '../../services/quotation/strategy.service';
import { UserStrategyListResponseDto, UserStrategyResponseDto } from './dto/user-strategy-response.dto';
import { EditWeightsRequestDto } from './dto/edit-weights-request.dto';
import { EditPositionWeightsRequestDto } from './dto/edit-position-weights-request.dto';

/**
 * Las dos estrategias de valuación propias del usuario autenticado
 * (019-per-user-valuation-strategies, reemplaza el modelo de estrategia
 * única de sistema de 012-valuation-strategies). Bajo JwtAuthGuard (global):
 * toda operación aquí es ligada a un usuario individual (constitución,
 * Principio IV).
 */
@ApiTags('user-strategies')
@ApiBearerAuth()
@Controller('users/me/strategies')
export class UserStrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mis dos estrategias propias' })
  @ApiResponse({ status: 200, type: UserStrategyListResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async list(@CurrentUser() userId: string): Promise<UserStrategyListResponseDto> {
    const strategies = await this.strategyService.listStrategies(userId);
    return UserStrategyListResponseDto.fromDomain(strategies);
  }

  @Patch(':id/select')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar una de mis estrategias como seleccionada' })
  @ApiResponse({ status: 200, type: UserStrategyResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'La estrategia no es propia del usuario autenticado' })
  @ApiResponse({ status: 404, description: 'La estrategia no existe' })
  async select(
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ): Promise<UserStrategyResponseDto> {
    const strategy = await this.strategyService.selectStrategy(userId, id);
    return UserStrategyResponseDto.fromDomain(strategy);
  }

  @Patch(':id/weights')
  @HttpCode(200)
  @ApiOperation({ summary: 'Editar los pesos generales de una de mis estrategias' })
  @ApiResponse({ status: 200, type: UserStrategyResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'La estrategia no es propia del usuario autenticado' })
  @ApiResponse({ status: 404, description: 'La estrategia no existe' })
  @ApiResponse({ status: 422, description: 'La suma de los pesos no es 1.0 ±0.001' })
  async editWeights(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() body: EditWeightsRequestDto,
  ): Promise<UserStrategyResponseDto> {
    const strategy = await this.strategyService.editWeights(userId, id, body.weights);
    return UserStrategyResponseDto.fromDomain(strategy);
  }

  @Patch(':id/position-weights/:position')
  @HttpCode(200)
  @ApiOperation({ summary: 'Editar el perfil de pesos de una posición de una de mis estrategias' })
  @ApiResponse({ status: 200, type: UserStrategyResponseDto })
  @ApiResponse({ status: 400, description: 'Posición inválida (no es FW/MF/DF/GK)' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'La estrategia no es propia del usuario autenticado' })
  @ApiResponse({ status: 404, description: 'La estrategia no existe' })
  @ApiResponse({ status: 422, description: 'La suma de los pesos del perfil no es 1.0 ±0.001' })
  async editPositionWeights(
    @Param('id') id: string,
    @Param('position') position: string,
    @CurrentUser() userId: string,
    @Body() body: EditPositionWeightsRequestDto,
  ): Promise<UserStrategyResponseDto> {
    const strategy = await this.strategyService.editPositionWeights(
      userId,
      id,
      parsePosition(position),
      body.weights,
    );
    return UserStrategyResponseDto.fromDomain(strategy);
  }
}

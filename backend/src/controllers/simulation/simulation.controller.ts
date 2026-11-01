import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../../guards/public.decorator';
import { AdminAccessGuard } from '../../guards/auth/admin-access.guard';
import { MarketSimulationService } from '../../services/simulation/market-simulation.service';
import { SimulationResultDto } from './dto/simulation-result.dto';

/**
 * Controller de administración para disparar la simulación interactiva del mercado.
 * Protegido por AdminAccessGuard (permite ApiKey de admin o JWT Bearer con rol admin).
 */
@ApiTags('admin')
@ApiSecurity('ApiKeyAuth')
@ApiBearerAuth()
@Public()
@UseGuards(AdminAccessGuard)
@Controller('admin')
export class SimulationController {
  constructor(private readonly simulationService: MarketSimulationService) {}

  @Post('simulate-market')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Ejecuta una simulación interactiva de alto volumen para la cuenta de administrador (órdenes en varios estados, historial de compras/ventas, holdings en portfolio y profundidad de libro L2).',
  })
  @ApiResponse({
    status: 200,
    description: 'Simulación completada con éxito.',
    type: SimulationResultDto,
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'No autorizado (se requiere rol ADMIN).' })
  async simulateMarket(): Promise<SimulationResultDto> {
    return this.simulationService.simulate();
  }
}


import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../guards/public.decorator';
import { HealthService } from '../../services/observability/health.service';
import { HealthResponseDto } from './dto/health-response.dto';
import { Sla } from '../../shared/observability/metrics/sla';

/**
 * Health check público (spec 027): sin JWT ni API key, para monitoreo y orquestador.
 * Solo expone el estado de disponibilidad por componente, sin datos sensibles.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Sla('technical')
  @Public()
  @ApiOperation({
    summary:
      'Informa si el backend está en condiciones de atender requests. Verifica la conexión a la base de datos (no las APIs externas) y es público.',
  })
  @ApiResponse({
    status: 200,
    description: 'La base de datos responde: estado general "ok".',
    type: HealthResponseDto,
  })
  @ApiResponse({
    status: 503,
    description:
      'La base de datos no responde, rechaza la consulta o supera el timeout: estado general "error", con el componente caído en "down".',
    type: HealthResponseDto,
  })
  async getHealth(@Res({ passthrough: true }) res: Response): Promise<HealthResponseDto> {
    const report = await this.healthService.check();
    if (report.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}

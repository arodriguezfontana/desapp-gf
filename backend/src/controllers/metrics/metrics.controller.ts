import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../guards/public.decorator';
import { MetricsService } from '../../services/metrics/metrics.service';
import { Sla } from '../../shared/metrics/sla';

/**
 * Métricas técnicas públicas (spec 029): sin JWT ni API key, porque un scraper de Prometheus
 * no lleva el token de la aplicación. Solo expone duración y conteo de requests por método,
 * ruta y código de estado, sin datos de usuarios ni de las requests.
 */
@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Sla('technical')
  @Public()
  @ApiOperation({
    summary:
      'Métricas de requests en formato de texto de Prometheus: histograma de duración (http_request_duration_seconds) y contador (http_requests_total), por método, ruta y código de estado. Es público. Las rutas inexistentes o rechazadas antes de resolverse se agrupan bajo route="unmatched".',
  })
  @ApiProduces('text/plain')
  @ApiResponse({
    status: 200,
    description: 'Texto en formato de exposición de Prometheus (text/plain; version=0.0.4).',
  })
  async getMetrics(@Res({ passthrough: true }) res: Response): Promise<string> {
    res.type(this.metricsService.contentType);
    return this.metricsService.render();
  }
}

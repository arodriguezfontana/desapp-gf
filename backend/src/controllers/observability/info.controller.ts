import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../guards/public.decorator';
import { InfoService } from '../../services/observability/info.service';
import { Sla } from '../../shared/observability/metrics/sla';
import { InfoResponseDto } from './dto/info-response.dto';

/**
 * Información del servicio, pública como `/health` y `/metrics`: sirve para saber qué versión y
 * qué commit están desplegados. No expone configuración, secretos ni variables de entorno salvo
 * `NODE_ENV` y `GIT_COMMIT`.
 */
@ApiTags('info')
@Controller('info')
export class InfoController {
  constructor(private readonly infoService: InfoService) {}

  @Get()
  @Sla('technical')
  @Public()
  @ApiOperation({
    summary:
      'Nombre, versión, commit desplegado, entorno, versión de Node, arranque y uptime del backend. Es público.',
  })
  @ApiResponse({ status: 200, type: InfoResponseDto })
  getInfo(): InfoResponseDto {
    return this.infoService.getInfo();
  }
}

import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../../guards/api-key/admin-api-key.guard';
import { Public } from '../../guards/public.decorator';
import { QuotationService } from '../../services/quotation/quotation.service';
import { RecalculateResponseDto } from './dto/recalculate-response.dto';
import { Sla } from '../../shared/observability/metrics/sla';
import { AuditedOperation } from '../../shared/observability/business-audit/audited-operation.decorator';

/**
 * Recálculo global de cotizaciones, disparado manualmente por el admin
 * Protegido por AdminApiKeyGuard; @Public() omite el JwtAuthGuard global.
 */
@ApiTags('quotes')
@ApiSecurity('api-key')
@Public()
@UseGuards(AdminApiKeyGuard)
@Controller('quotes')
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Post('recalculate')
  @Sla('system-long')
  @AuditedOperation('QUOTES_RECALCULATED', { actor: 'system' })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recálculo global de cotizaciones (admin)',
    description:
      'Recalcula y persiste una cotización por cada combinación usuario × jugador del sistema, usando la estrategia seleccionada de cada usuario. Lock a nivel sistema: 409 si ya hay un recálculo en curso. Las combinaciones que fallan se saltean; la respuesta indica cuáles se procesaron y cuáles no.',
  })
  @ApiResponse({ status: 200, type: RecalculateResponseDto })
  @ApiResponse({ status: 401, description: 'API key ausente o inválida' })
  @ApiResponse({ status: 403, description: 'La API key no es de admin' })
  @ApiResponse({ status: 409, description: 'Ya hay un recálculo global en curso' })
  async recalculate(): Promise<RecalculateResponseDto> {
    const result = await this.quotationService.recalculateAll('manual');
    return RecalculateResponseDto.fromDomain(result);
  }
}

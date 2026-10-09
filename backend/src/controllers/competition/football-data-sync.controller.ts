import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../../guards/api-key/admin-api-key.guard';
import { Public } from '../../guards/public.decorator';
import { FootballDataSyncService } from '../../services/competition/football-data-sync.service';
import { SyncSummaryDto } from './dto/sync-summary.dto';

@ApiTags('sync')
@ApiSecurity('ApiKeyAuth')
@Public()
@UseGuards(AdminApiKeyGuard)
@Controller('sync')
export class FootballDataSyncController {
  constructor(private readonly footballDataSyncService: FootballDataSyncService) {}

  @Post('football-data')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dispara la sincronización de Football-Data (sincrónico, ~70 s)' })
  @ApiResponse({ status: 200, description: 'Resumen de la corrida por liga.', type: SyncSummaryDto })
  @ApiResponse({ status: 401, description: 'Sin ApiKey válida.' })
  @ApiResponse({ status: 409, description: 'Ya hay una corrida de Football-Data en curso.' })
  async triggerFootballData(): Promise<SyncSummaryDto> {
    const summary = await this.footballDataSyncService.triggerManualRun();
    return SyncSummaryDto.fromDomain(summary);
  }
}

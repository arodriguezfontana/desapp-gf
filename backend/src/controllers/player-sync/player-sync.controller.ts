import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';
import { Public } from '../../guards/public.decorator';
import { PlayerSyncService } from '../../services/player-sync/player-sync.service';
import { SyncAcceptedDto } from './dto/sync-accepted.dto';
import { SyncRunStatusDto } from './dto/sync-run-status.dto';
import { SYNC_RUN_NOT_FOUND_MESSAGE } from '../../shared/errors/messages';

@ApiTags('sync')
@ApiSecurity('ApiKeyAuth')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('sync')
export class PlayerSyncController {
  constructor(private readonly playerSyncService: PlayerSyncService) {}

  @Post('whoscored')
  @HttpCode(202)
  @ApiOperation({ summary: 'Dispara la sincronización de WhoScored en background' })
  @ApiResponse({ status: 202, description: 'Corrida iniciada. Usar el runId para consultar el estado.', type: SyncAcceptedDto })
  @ApiResponse({ status: 401, description: 'Sin ApiKey válida.' })
  @ApiResponse({ status: 409, description: 'Ya hay una corrida de WhoScored en curso.' })
  triggerWhoScored(): SyncAcceptedDto {
    const runId = this.playerSyncService.startManualRun();
    return SyncAcceptedDto.fromDomain(this.playerSyncService.getRun(runId)!);
  }

  @Get('whoscored/:runId')
  @ApiOperation({ summary: 'Estado y resumen de una corrida de WhoScored' })
  @ApiResponse({ status: 200, description: 'Estado de la corrida.', type: SyncRunStatusDto })
  @ApiResponse({ status: 401, description: 'Sin ApiKey válida.' })
  @ApiResponse({ status: 404, description: 'runId inexistente, descartado o perdido por reinicio.' })
  getWhoScoredRun(@Param('runId') runId: string): SyncRunStatusDto {
    const state = this.playerSyncService.getRun(runId);
    if (!state) throw new NotFoundException(SYNC_RUN_NOT_FOUND_MESSAGE);
    return SyncRunStatusDto.fromDomain(state);
  }
}

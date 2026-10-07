import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SyncRunState, SyncFailedUnit } from '../../../domain/player/sync-run';

class SyncFailedUnitDto {
  @ApiProperty()
  league!: string;

  @ApiPropertyOptional()
  team?: string;

  @ApiProperty({ enum: ['league-fetch-failed', 'no-seed-player', 'roster-fetch-failed'] })
  reason!: 'league-fetch-failed' | 'no-seed-player' | 'roster-fetch-failed';

  static fromDomain(unit: SyncFailedUnit): SyncFailedUnitDto {
    const dto = new SyncFailedUnitDto();
    dto.league = String(unit.league);
    if (unit.team !== undefined) dto.team = unit.team;
    dto.reason = unit.reason;
    return dto;
  }
}

export class SyncRunStatusDto {
  @ApiProperty({ example: '3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b' })
  runId!: string;

  @ApiProperty({ enum: ['running', 'completed', 'failed'] })
  status!: 'running' | 'completed' | 'failed';

  @ApiProperty({ enum: ['manual', 'cron'] })
  trigger!: 'manual' | 'cron';

  @ApiProperty()
  startedAt!: string;

  @ApiPropertyOptional()
  finishedAt?: string;

  @ApiPropertyOptional()
  teamsSynced?: number;

  @ApiPropertyOptional()
  playersSynced?: number;

  @ApiPropertyOptional({ type: [SyncFailedUnitDto] })
  failedUnits?: SyncFailedUnitDto[];

  @ApiPropertyOptional()
  errorMessage?: string;

  static fromDomain(state: SyncRunState): SyncRunStatusDto {
    const dto = new SyncRunStatusDto();
    dto.runId = state.runId;
    dto.status = state.status;
    dto.trigger = state.trigger;
    dto.startedAt = state.startedAt.toISOString();
    if (state.finishedAt) dto.finishedAt = state.finishedAt.toISOString();
    if (state.summary) {
      dto.teamsSynced = state.summary.teamsSynced;
      dto.playersSynced = state.summary.playersSynced;
      dto.failedUnits = state.summary.failedUnits.map(SyncFailedUnitDto.fromDomain);
    }
    if (state.errorMessage) dto.errorMessage = state.errorMessage;
    return dto;
  }
}

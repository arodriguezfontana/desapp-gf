import { ApiProperty } from '@nestjs/swagger';
import {
  FootballDataSyncSummary,
  LeagueSyncResult,
} from '../../../domain/competition/sync-summary';

class LeagueSyncResultDto {
  @ApiProperty({ example: 'PL' })
  leagueCode!: string;

  @ApiProperty({ example: 20 })
  standingsSynced!: number;

  @ApiProperty({ example: 380 })
  matchesSynced!: number;

  @ApiProperty({ type: [String], enum: ['standings', 'matches'], example: [] })
  failedSteps!: ('standings' | 'matches')[];

  static fromDomain(result: LeagueSyncResult): LeagueSyncResultDto {
    const dto = new LeagueSyncResultDto();
    dto.leagueCode = result.leagueCode;
    dto.standingsSynced = result.standingsSynced;
    dto.matchesSynced = result.matchesSynced;
    dto.failedSteps = result.failedSteps;
    return dto;
  }
}

export class SyncSummaryDto {
  @ApiProperty({ type: [LeagueSyncResultDto] })
  leagues!: LeagueSyncResultDto[];

  @ApiProperty({ type: [String], example: [] })
  failedLeagues!: string[];

  static fromDomain(summary: FootballDataSyncSummary): SyncSummaryDto {
    const dto = new SyncSummaryDto();
    dto.leagues = summary.leagues.map(LeagueSyncResultDto.fromDomain);
    dto.failedLeagues = summary.failedLeagues;
    return dto;
  }
}

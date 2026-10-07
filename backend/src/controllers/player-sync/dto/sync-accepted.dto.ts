import { ApiProperty } from '@nestjs/swagger';
import { SyncRunState } from '../../../domain/player/sync-run';

export class SyncAcceptedDto {
  @ApiProperty({ example: '3f9a1c7e-1b2d-4e5f-8a9b-0c1d2e3f4a5b' })
  runId!: string;

  @ApiProperty({ example: 'running', enum: ['running'] })
  status!: 'running';

  static fromDomain(state: SyncRunState): SyncAcceptedDto {
    const dto = new SyncAcceptedDto();
    dto.runId = state.runId;
    dto.status = 'running';
    return dto;
  }
}

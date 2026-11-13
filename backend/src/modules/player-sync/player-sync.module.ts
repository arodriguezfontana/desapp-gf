import { Module } from '@nestjs/common';
import { RuntimeModule } from '../runtime/runtime.module';
import { ScheduleModule } from '@nestjs/schedule';

import { PlayerModule } from '../player/player.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { WHOSCORED_ADAPTER } from './player-sync.constants';
import { HttpWhoScoredAdapter } from '../../adapters/player-sync/http-whoscored-adapter';
import { PlayerSyncService } from '../../services/player-sync/player-sync.service';
import { PlayerSyncController } from '../../controllers/player-sync/player-sync.controller';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';
import { MetricsModule } from '../observability/metrics.module';
import { SyncLastSuccessModule } from '../observability/sync-last-success.module';

/**
 * Lado de escritura del catálogo (006-whoscored-catalog-sync): separado de
 * `PlayerModule` (lado de lectura, `004-player-catalog`, sin cambios) para
 * que `PlayerController`/`PlayerService` nunca puedan importar, ni siquiera
 * transitivamente, el Adapter ni el scheduler. Reusa `PlayerRepository` que
 * `PlayerModule` ya exporta.
 *
 * Spec 009: agrega `PlayerSyncController` (POST /sync/whoscored, GET /sync/whoscored/:runId)
 * protegido con `ApiKeyGuard`.
 */
@Module({
  imports: [RuntimeModule, PlayerModule, ApiKeyModule, ScheduleModule.forRoot(), MetricsModule, SyncLastSuccessModule],
  controllers: [PlayerSyncController],
  providers: [
    PlayerSyncService,
    ApiKeyGuard,
    { provide: WHOSCORED_ADAPTER, useClass: HttpWhoScoredAdapter },
  ],
})
export class PlayerSyncModule {}

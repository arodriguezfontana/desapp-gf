import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PlayerModule } from '../player/player.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { WHOSCORED_ADAPTER } from './player-sync.constants';
import { HttpWhoScoredAdapter } from '../../adapters/player-sync/http-whoscored-adapter';
import { PlayerSyncService } from '../../services/player-sync/player-sync.service';
import { PlayerSyncController } from '../../controllers/player-sync/player-sync.controller';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';

/**
 * Lado de escritura del catálogo (006-whoscored-catalog-sync): separado de
 * `PlayerModule` (lado de lectura, `004-player-catalog`, sin cambios) para
 * que `PlayerController`/`PlayerService` nunca puedan importar, ni siquiera
 * transitivamente, el Adapter ni el scheduler. Reusa `PLAYER_REPOSITORY` que
 * `PlayerModule` ya exporta.
 *
 * Spec 009: agrega `PlayerSyncController` (POST /sync/whoscored, GET /sync/whoscored/:runId)
 * protegido con `ApiKeyGuard`.
 */
@Module({
  imports: [PlayerModule, ApiKeyModule, ScheduleModule.forRoot()],
  controllers: [PlayerSyncController],
  providers: [
    PlayerSyncService,
    ApiKeyGuard,
    { provide: WHOSCORED_ADAPTER, useClass: HttpWhoScoredAdapter },
  ],
})
export class PlayerSyncModule {}

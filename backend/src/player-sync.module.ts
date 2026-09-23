import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PlayerModule } from './player.module';
import { WHOSCORED_ADAPTER } from './player-sync.constants';
import { HttpWhoScoredAdapter } from './adapters/http-whoscored-adapter';
import { PlayerSyncService } from './services/player-sync.service';

/**
 * Lado de escritura del catálogo (006-whoscored-catalog-sync): separado de
 * `PlayerModule` (lado de lectura, `004-player-catalog`, sin cambios) para
 * que `PlayerController`/`PlayerService` nunca puedan importar, ni siquiera
 * transitivamente, el Adapter ni el scheduler. Reusa `PLAYER_REPOSITORY` que
 * `PlayerModule` ya exporta.
 */
@Module({
  imports: [PlayerModule, ScheduleModule.forRoot()],
  providers: [
    PlayerSyncService,
    { provide: WHOSCORED_ADAPTER, useClass: HttpWhoScoredAdapter },
  ],
})
export class PlayerSyncModule {}

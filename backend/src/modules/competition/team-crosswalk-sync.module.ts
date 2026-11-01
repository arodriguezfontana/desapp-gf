import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PlayerModule } from '../player/player.module';
import { FootballDataSyncModule } from './football-data-sync.module';
import { TeamCrosswalkModule } from './team-crosswalk.module';
import { TeamCrosswalkSyncService } from '../../services/competition/team-crosswalk-sync.service';

/**
 * Lado de escritura del crosswalk: separado de `TeamCrosswalkModule` (que `PlayerModule`
 * importa para leer escudos) para no crear una dependencia circular con `PlayerModule`.
 */
@Module({
  imports: [ScheduleModule.forRoot(), PlayerModule, FootballDataSyncModule, TeamCrosswalkModule],
  providers: [TeamCrosswalkSyncService],
})
export class TeamCrosswalkSyncModule {}

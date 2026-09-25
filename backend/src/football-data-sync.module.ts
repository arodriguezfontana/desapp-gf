import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchEntity } from './repositories/entities/match.entity';
import { StandingEntity } from './repositories/entities/standing.entity';
import { MATCH_REPOSITORY } from './repositories/match.repository';
import { TypeOrmMatchRepository } from './repositories/typeorm-match.repository';
import { MatchMapper } from './repositories/mappers/match.mapper';
import { STANDING_REPOSITORY } from './repositories/standing.repository';
import { TypeOrmStandingRepository } from './repositories/typeorm-standing.repository';
import { StandingMapper } from './repositories/mappers/standing.mapper';
import { FOOTBALL_DATA_ADAPTER } from './adapters/football-data-adapter';
import { HttpFootballDataAdapter } from './adapters/http-football-data-adapter';
import { FootballDataSyncService } from './services/football-data-sync.service';

/**
 * Módulo de sincronización de Football-Data.org.
 * Totalmente aislado: no expone controllers REST.
 * Encapsula la sincronización y persistencia periódica de partidos y posiciones.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MatchEntity, StandingEntity]),
    ScheduleModule.forRoot(),
  ],
  providers: [
    FootballDataSyncService,
    MatchMapper,
    StandingMapper,
    { provide: FOOTBALL_DATA_ADAPTER, useClass: HttpFootballDataAdapter },
    { provide: MATCH_REPOSITORY, useClass: TypeOrmMatchRepository },
    { provide: STANDING_REPOSITORY, useClass: TypeOrmStandingRepository },
  ],
  exports: [FootballDataSyncService, MATCH_REPOSITORY, STANDING_REPOSITORY],
})
export class FootballDataSyncModule {}


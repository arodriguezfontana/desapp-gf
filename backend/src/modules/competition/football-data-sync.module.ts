import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchEntity } from '../../repositories/competition/entities/match.entity';
import { StandingEntity } from '../../repositories/competition/entities/standing.entity';
import { TypeOrmMatchRepository } from '../../repositories/competition/typeorm-match.repository';
import { MatchMapper } from '../../repositories/competition/mappers/match.mapper';
import { TypeOrmStandingRepository } from '../../repositories/competition/typeorm-standing.repository';
import { StandingMapper } from '../../repositories/competition/mappers/standing.mapper';
import { HttpFootballDataAdapter } from '../../adapters/competition/http-football-data-adapter';
import { FootballDataSyncService } from '../../services/competition/football-data-sync.service';
import {
  FOOTBALL_DATA_ADAPTER,
  MATCH_REPOSITORY,
  STANDING_REPOSITORY,
} from './football-data-sync.constants';

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


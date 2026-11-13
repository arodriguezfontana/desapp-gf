import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchEntity } from '../../repositories/competition/entities/match.entity';
import { StandingEntity } from '../../repositories/competition/entities/standing.entity';
import { MatchRepository } from '../../repositories/competition/match.repository';
import { MatchMapper } from '../../repositories/competition/mappers/match.mapper';
import { StandingRepository } from '../../repositories/competition/standing.repository';
import { StandingMapper } from '../../repositories/competition/mappers/standing.mapper';
import { HttpFootballDataAdapter } from '../../adapters/competition/http-football-data-adapter';
import { FootballDataSyncService } from '../../services/competition/football-data-sync.service';
import { FootballDataSyncController } from '../../controllers/competition/football-data-sync.controller';
import { ApiKeyModule } from '../api-key/api-key.module';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';
import {
  FOOTBALL_DATA_ADAPTER,
} from './football-data-sync.constants';

/**
 * Módulo de sincronización de Football-Data.org.
 * Spec 009: agrega `FootballDataSyncController` (POST /sync/football-data) protegido
 * con `ApiKeyGuard`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MatchEntity, StandingEntity]),
    ScheduleModule.forRoot(),
    ApiKeyModule,
  ],
  controllers: [FootballDataSyncController],
  providers: [
    FootballDataSyncService,
    ApiKeyGuard,
    MatchMapper,
    StandingMapper,
    { provide: FOOTBALL_DATA_ADAPTER, useClass: HttpFootballDataAdapter },
    MatchRepository,
    StandingRepository,
  ],
  exports: [FootballDataSyncService, MatchRepository, StandingRepository],
})
export class FootballDataSyncModule {}


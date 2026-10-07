import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyModule } from '../api-key/api-key.module';
import { TeamCrosswalkModule } from '../competition/team-crosswalk.module';
import { PLAYER_REPOSITORY } from './player.constants';
import { ApiKeyGuard } from '../../guards/api-key/api-key.guard';
import { PlayerController } from '../../controllers/player/player.controller';
import { PlayerEntity } from '../../repositories/player/entities/player.entity';
import { PlayerMapper } from '../../repositories/player/mappers/player.mapper';
import { TypeOrmPlayerRepository } from '../../repositories/player/typeorm-player.repository';
import { PlayerService } from '../../services/player/player.service';
import { PlayerEnrichmentService } from '../../services/player/player-enrichment.service';

@Module({
  imports: [
    ApiKeyModule,
    TypeOrmModule.forFeature([PlayerEntity]),
    TeamCrosswalkModule,
  ],
  controllers: [PlayerController],
  providers: [
    PlayerService,
    PlayerEnrichmentService,
    PlayerMapper,
    ApiKeyGuard,
    { provide: PLAYER_REPOSITORY, useClass: TypeOrmPlayerRepository },
  ],
  exports: [PLAYER_REPOSITORY],
})
export class PlayerModule {}

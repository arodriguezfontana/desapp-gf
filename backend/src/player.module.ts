import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyModule } from './api-key.module';
import { PLAYER_REPOSITORY } from './player.constants';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PlayerController } from './controllers/player.controller';
import { PlayerEntity } from './repositories/entities/player.entity';
import { PlayerMapper } from './repositories/mappers/player.mapper';
import { TypeOrmPlayerRepository } from './repositories/typeorm-player.repository';
import { PlayerService } from './services/player.service';

@Module({
  imports: [ApiKeyModule, TypeOrmModule.forFeature([PlayerEntity])],
  controllers: [PlayerController],
  providers: [
    PlayerService,
    PlayerMapper,
    ApiKeyGuard,
    { provide: PLAYER_REPOSITORY, useClass: TypeOrmPlayerRepository },
  ],
})
export class PlayerModule {}

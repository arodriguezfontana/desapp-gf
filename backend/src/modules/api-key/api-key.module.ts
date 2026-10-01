import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { API_KEY_REPOSITORY, TOKEN_HASHER } from './api-key.constants';
import { Sha256TokenHasher } from '../../adapters/api-key/sha256-token-hasher';
import { ApiKeyController } from '../../controllers/api-key/api-key.controller';
import { ApiKeyEntity } from '../../repositories/api-key/entities/api-key.entity';
import { ApiKeyMapper } from '../../repositories/api-key/mappers/api-key.mapper';
import { TypeOrmApiKeyRepository } from '../../repositories/api-key/typeorm-api-key.repository';
import { ApiKeyService } from '../../services/api-key/api-key.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKeyEntity])],
  controllers: [ApiKeyController],
  providers: [
    ApiKeyService,
    ApiKeyMapper,
    { provide: API_KEY_REPOSITORY, useClass: TypeOrmApiKeyRepository },
    { provide: TOKEN_HASHER, useClass: Sha256TokenHasher },
  ],
  exports: [API_KEY_REPOSITORY, TOKEN_HASHER],
})
export class ApiKeyModule {}

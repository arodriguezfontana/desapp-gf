import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { API_KEY_REPOSITORY, TOKEN_HASHER } from './api-key.constants';
import { Sha256TokenHasher } from './adapters/sha256-token-hasher';
import { ApiKeyController } from './controller/api-key.controller';
import { ApiKeyEntity } from './repository/entities/api-key.entity';
import { ApiKeyMapper } from './repository/mappers/api-key.mapper';
import { TypeOrmApiKeyRepository } from './repository/typeorm-api-key.repository';
import { ApiKeyService } from './service/api-key.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKeyEntity])],
  controllers: [ApiKeyController],
  providers: [
    ApiKeyService,
    ApiKeyMapper,
    { provide: API_KEY_REPOSITORY, useClass: TypeOrmApiKeyRepository },
    { provide: TOKEN_HASHER, useClass: Sha256TokenHasher },
  ],
})
export class ApiKeyModule {}

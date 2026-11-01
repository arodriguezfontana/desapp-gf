import { forwardRef, Module } from '@nestjs/common';
import { RuntimeModule } from '../runtime/runtime.module';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { TOKEN_HASHER } from './api-key.constants';
import { Sha256TokenHasher } from '../../adapters/api-key/sha256-token-hasher';
import { ApiKeyController } from '../../controllers/api-key/api-key.controller';
import { ApiKeyEntity } from '../../repositories/api-key/entities/api-key.entity';
import { ApiKeyMapper } from '../../repositories/api-key/mappers/api-key.mapper';
import { ApiKeyRepository } from '../../repositories/api-key/api-key.repository';
import { ApiKeyService } from '../../services/api-key/api-key.service';

@Module({
  // AuthModule: el controller de emisión necesita AuthService para resolver el User emisor (spec 008, R2).
  imports: [RuntimeModule, TypeOrmModule.forFeature([ApiKeyEntity]), forwardRef(() => AuthModule)],
  controllers: [ApiKeyController],
  providers: [
    ApiKeyService,
    ApiKeyMapper,
    ApiKeyRepository,
    { provide: TOKEN_HASHER, useClass: Sha256TokenHasher },
  ],
  exports: [ApiKeyRepository, TOKEN_HASHER],
})
export class ApiKeyModule {}

import { Injectable } from '@nestjs/common';
import { ApiKey } from '../../domain/api-key/api-key';
import { ApiKeyEntity } from '../entities/api-key.entity';

/** Conversion dominio <-> persistencia. Sin logica de negocio. */
@Injectable()
export class ApiKeyMapper {
  toDomain(entity: ApiKeyEntity): ApiKey {
    return ApiKey.restore(
      entity.id,
      entity.userId,
      entity.keyHash,
      entity.createdAt,
      entity.revokedAt,
    );
  }

  toEntity(apiKey: ApiKey): ApiKeyEntity {
    const entity = new ApiKeyEntity();
    entity.id = apiKey.id;
    entity.userId = apiKey.userId;
    entity.keyHash = apiKey.keyHash;
    entity.createdAt = apiKey.createdAt;
    entity.revokedAt = apiKey.revokedAt;
    return entity;
  }
}

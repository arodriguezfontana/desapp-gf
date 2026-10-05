import { Injectable } from '@nestjs/common';
import { ApiKey } from '../../../domain/api-key/api-key';
import { parseUserRole } from '../../../domain/auth/user-role';
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
      parseUserRole(entity.role),
    );
  }

  toEntity(apiKey: ApiKey): ApiKeyEntity {
    const entity = new ApiKeyEntity();
    entity.id = apiKey.id;
    entity.userId = apiKey.userId;
    entity.keyHash = apiKey.keyHash;
    entity.createdAt = apiKey.createdAt;
    entity.revokedAt = apiKey.revokedAt;
    entity.role = apiKey.role;
    return entity;
  }
}

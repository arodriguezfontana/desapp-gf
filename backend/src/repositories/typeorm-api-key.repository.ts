import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ApiKey } from '../domain/api-key/api-key';
import { ApiKeyEntity } from './entities/api-key.entity';
import { ApiKeyMapper } from './mappers/api-key.mapper';
import { ApiKeyRepository } from './api-key.repository';

@Injectable()
export class TypeOrmApiKeyRepository implements ApiKeyRepository {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly repo: Repository<ApiKeyEntity>,
    private readonly mapper: ApiKeyMapper,
    private readonly dataSource: DataSource,
  ) {}

  async findActiveByUserId(userId: string): Promise<ApiKey | null> {
    const entity = await this.repo.findOne({
      where: { userId, revokedAt: IsNull() },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const entity = await this.repo.findOne({ where: { keyHash } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async save(apiKey: ApiKey): Promise<void> {
    await this.repo.insert(this.mapper.toEntity(apiKey));
  }

  async saveWithRevocation(newKey: ApiKey, previousKey?: ApiKey): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (previousKey) {
        await manager.update(
          ApiKeyEntity,
          { id: previousKey.id },
          { revokedAt: previousKey.revokedAt },
        );
      }
      await manager.insert(ApiKeyEntity, this.mapper.toEntity(newKey));
    });
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertStatus, PriceAlert } from '../../domain/alerts/price-alert';
import { PriceAlertEntity } from './entities/price-alert.entity';
import { PriceAlertMapper } from './price-alert.mapper';

@Injectable()
export class PriceAlertRepository {
  constructor(
    @InjectRepository(PriceAlertEntity)
    private readonly repo: Repository<PriceAlertEntity>,
    private readonly mapper: PriceAlertMapper,
  ) {}

  async save(alert: PriceAlert): Promise<PriceAlert> {
    const saved = await this.repo.save(this.mapper.toPersistence(alert));
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<PriceAlert | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findActiveByUserIdAndPlayerId(userId: string, playerId: string): Promise<PriceAlert[]> {
    const entities = await this.repo.find({
      where: { userId, playerId, status: AlertStatus.ACTIVE },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findAllByUserId(userId: string): Promise<PriceAlert[]> {
    const entities = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }
}

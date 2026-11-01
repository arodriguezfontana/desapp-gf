import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { StrategyNotFoundError } from '../../domain/quotation/errors/strategy-not-found.error';
import { ValuationStrategyEntity } from './entities/valuation-strategy.entity';
import { ValuationStrategyMapper } from './valuation-strategy.mapper';

@Injectable()
export class ValuationStrategyRepository {
  constructor(
    @InjectRepository(ValuationStrategyEntity)
    private readonly repo: Repository<ValuationStrategyEntity>,
    private readonly mapper: ValuationStrategyMapper,
    private readonly dataSource: DataSource,
  ) {}

  async findByUserId(userId: string): Promise<ValuationStrategy[]> {
    const entities = await this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    return entities.map((entity) => this.mapper.toDomain(entity));
  }

  async findById(id: string): Promise<ValuationStrategy | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async save(strategy: ValuationStrategy): Promise<ValuationStrategy> {
    const entity = await this.repo.save(this.mapper.toPersistence(strategy));
    return this.mapper.toDomain(entity as ValuationStrategyEntity);
  }

  /**
   * Crea (o reemplaza) el par de estrategias de un usuario como una unidad
   * atómica: ambas se persisten o ninguna (019, plan.md Principio VI).
   */
  async saveMany(strategies: ValuationStrategy[]): Promise<ValuationStrategy[]> {
    if (strategies.length === 0) return [];
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const saved = await qr.manager.save(
        ValuationStrategyEntity,
        strategies.map((s) => this.mapper.toPersistence(s)),
      );
      await qr.commitTransaction();
      return saved.map((entity) => this.mapper.toDomain(entity));
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  async findAllUserIds(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('s')
      .select('DISTINCT s.userId', 'userId')
      .getRawMany<{ userId: string }>();
    return rows.map((r) => r.userId);
  }

  /**
   * Desmarca la estrategia seleccionada previa del usuario y marca la
   * indicada, en una única transacción acotada por `userId` (spec FR-005,
   * research.md D1 — mismo patrón que el `activateStrategy` global anterior,
   * ahora `WHERE user_id = :userId`).
   */
  async selectStrategy(userId: string, id: string): Promise<ValuationStrategy> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.update(
        ValuationStrategyEntity,
        { userId, isSelected: true },
        { isSelected: false },
      );
      const result = await qr.manager.update(
        ValuationStrategyEntity,
        { id, userId },
        { isSelected: true },
      );

      if (result.affected === 0) {
        throw new StrategyNotFoundError(id);
      }

      const entity = await qr.manager.findOne(ValuationStrategyEntity, { where: { id, userId } });
      await qr.commitTransaction();
      return this.mapper.toDomain(entity!);
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}

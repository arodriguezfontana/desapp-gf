import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ValuationStrategy } from '../../domain/quotation/valuation-strategy';
import { StrategyNotFoundError } from '../../domain/quotation/errors/strategy-not-found.error';
import { ValuationStrategyRepository } from './valuation-strategy.repository';
import { ValuationStrategyEntity } from './entities/valuation-strategy.entity';
import { ValuationStrategyMapper } from './valuation-strategy.mapper';

@Injectable()
export class TypeOrmValuationStrategyRepository implements ValuationStrategyRepository {
  constructor(
    @InjectRepository(ValuationStrategyEntity)
    private readonly repo: Repository<ValuationStrategyEntity>,
    private readonly mapper: ValuationStrategyMapper,
    private readonly dataSource: DataSource,
  ) {}

  async findActive(): Promise<ValuationStrategy | null> {
    const entity = await this.repo.findOne({ where: { isActive: true } });
    return entity ? this.mapper.toDomain(entity) : null;
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
   * Desactiva todas las estrategias y activa la indicada en una única transacción.
   * Lanza StrategyNotFoundError si el id no existe.
   */
  async activateStrategy(id: string): Promise<ValuationStrategy> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.update(ValuationStrategyEntity, { isActive: true }, { isActive: false });
      const result = await qr.manager.update(ValuationStrategyEntity, { id }, { isActive: true });

      if (result.affected === 0) {
        throw new StrategyNotFoundError(id);
      }

      const entity = await qr.manager.findOne(ValuationStrategyEntity, { where: { id } });
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

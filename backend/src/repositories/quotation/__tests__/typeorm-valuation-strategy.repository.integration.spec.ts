import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../../../database/database.module';
import { StrategyNotFoundError } from '../../../domain/quotation/errors/strategy-not-found.error';
import { ValuationStrategyMapper } from '../valuation-strategy.mapper';
import { TypeOrmValuationStrategyRepository } from '../typeorm-valuation-strategy.repository';
import { ValuationStrategyEntity } from '../entities/valuation-strategy.entity';

const WEIGHTS_A = { goals: 0.5, assists: 0.3, rating: 0.2 };
const WEIGHTS_B = { totalTackles: 0.6, interceptions: 0.4 };

describe('TypeOrmValuationStrategyRepository (integración, spec 012 US3)', () => {
  let moduleRef: TestingModule;
  let repo: TypeOrmValuationStrategyRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([ValuationStrategyEntity]),
      ],
      providers: [ValuationStrategyMapper, TypeOrmValuationStrategyRepository],
    }).compile();

    repo = moduleRef.get(TypeOrmValuationStrategyRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    // Sólo borramos las estrategias que creamos en los tests (no las del seed)
    await dataSource.query(
      `DELETE FROM "valuation_strategies" WHERE "name" LIKE 'Test%'`,
    );
  });

  const insertStrategy = async (opts: {
    name: string;
    weights: Record<string, number>;
    factorEscala: number;
    isActive: boolean;
  }) => {
    const id = randomUUID();
    await dataSource.getRepository(ValuationStrategyEntity).insert({
      id,
      name: opts.name,
      weights: opts.weights,
      factorEscala: String(opts.factorEscala),
      isActive: opts.isActive,
    });
    return id;
  };

  it('findActive() devuelve la estrategia activa', async () => {
    await insertStrategy({ name: 'Test activa', weights: WEIGHTS_A, factorEscala: 50, isActive: true });

    const strategy = await repo.findActive();

    expect(strategy).not.toBeNull();
    expect(strategy!.isActive).toBe(true);
    expect(strategy!.factorEscala).toBe(50);
  });

  it('findActive() devuelve null cuando ninguna está activa', async () => {
    await insertStrategy({ name: 'Test inactiva', weights: WEIGHTS_A, factorEscala: 50, isActive: false });
    // Desactivar todas para aislar el test (update({}) rechazado por TypeORM; usamos query directa)
    await dataSource.query(`UPDATE "valuation_strategies" SET "is_active" = false WHERE "is_active" = true`);

    const strategy = await repo.findActive();

    expect(strategy).toBeNull();
  });

  it('findById() devuelve la estrategia por id', async () => {
    const id = await insertStrategy({ name: 'Test por id', weights: WEIGHTS_B, factorEscala: 99, isActive: false });

    const strategy = await repo.findById(id);

    expect(strategy).not.toBeNull();
    expect(strategy!.id).toBe(id);
    expect(strategy!.factorEscala).toBe(99);
    expect(strategy!.weights).toMatchObject(WEIGHTS_B);
  });

  it('findById() devuelve null para id inexistente', async () => {
    const result = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('activateStrategy() desactiva la anterior y activa la nueva en una transacción', async () => {
    const idA = await insertStrategy({ name: 'Test A (activa)', weights: WEIGHTS_A, factorEscala: 10, isActive: true });
    const idB = await insertStrategy({ name: 'Test B (inactiva)', weights: WEIGHTS_B, factorEscala: 20, isActive: false });

    await repo.activateStrategy(idB);

    const a = await repo.findById(idA);
    const b = await repo.findById(idB);

    expect(a!.isActive).toBe(false);
    expect(b!.isActive).toBe(true);
  });

  it('activateStrategy() lanza StrategyNotFoundError para id inexistente', async () => {
    await expect(
      repo.activateStrategy('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(StrategyNotFoundError);
  });

  it('save() persiste una nueva estrategia y devuelve el dominio con id asignado', async () => {
    const entity = dataSource.getRepository(ValuationStrategyEntity).create({
      name: 'Test save',
      weights: WEIGHTS_A,
      factorEscala: '15.0000',
      isActive: false,
    });
    const saved = await dataSource.getRepository(ValuationStrategyEntity).save(entity);
    const mapper = moduleRef.get(ValuationStrategyMapper);
    const domain = mapper.toDomain(saved);

    expect(domain.id).toBeDefined();
    expect(domain.factorEscala).toBe(15);
    expect(domain.weights).toMatchObject(WEIGHTS_A);
  });
});

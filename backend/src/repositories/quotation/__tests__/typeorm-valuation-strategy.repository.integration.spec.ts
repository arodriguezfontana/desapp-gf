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
import { UserEntity } from '../../../repositories/auth/entities/user.entity';

const WEIGHTS_A = { goals: 0.5, assists: 0.3, rating: 0.2 };
const WEIGHTS_B = { totalTackles: 0.6, interceptions: 0.4 };

describe('TypeOrmValuationStrategyRepository (integración, 019-per-user-valuation-strategies)', () => {
  let moduleRef: TestingModule;
  let repo: TypeOrmValuationStrategyRepository;
  let dataSource: DataSource;
  let userIdA: string;
  let userIdB: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([ValuationStrategyEntity, UserEntity]),
      ],
      providers: [ValuationStrategyMapper, TypeOrmValuationStrategyRepository],
    }).compile();

    repo = moduleRef.get(TypeOrmValuationStrategyRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  const insertUser = async (): Promise<string> => {
    const id = randomUUID();
    await dataSource.getRepository(UserEntity).insert({
      id,
      email: `${id}@test.local`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
      username: 'test-user',
    });
    return id;
  };

  beforeEach(async () => {
    userIdA = await insertUser();
    userIdB = await insertUser();
  });

  afterEach(async () => {
    await dataSource.getRepository(ValuationStrategyEntity).clear();
    await dataSource.getRepository(UserEntity).clear();
  });

  const insertStrategy = async (opts: {
    userId: string;
    name: string;
    weights: Record<string, number>;
    factorEscala: number;
    isSelected: boolean;
  }) => {
    const id = randomUUID();
    await dataSource.getRepository(ValuationStrategyEntity).insert({
      id,
      userId: opts.userId,
      name: opts.name,
      weights: opts.weights,
      factorEscala: String(opts.factorEscala),
      isSelected: opts.isSelected,
    });
    return id;
  };

  it('findByUserId() devuelve solo las estrategias del usuario indicado', async () => {
    await insertStrategy({ userId: userIdA, name: 'Test A', weights: WEIGHTS_A, factorEscala: 50, isSelected: true });
    await insertStrategy({ userId: userIdB, name: 'Test B', weights: WEIGHTS_B, factorEscala: 60, isSelected: true });

    const strategies = await repo.findByUserId(userIdA);

    expect(strategies).toHaveLength(1);
    expect(strategies[0].userId).toBe(userIdA);
    expect(strategies[0].isSelected).toBe(true);
  });

  it('findByUserId() devuelve array vacío si el usuario no tiene estrategias', async () => {
    const strategies = await repo.findByUserId(userIdA);
    expect(strategies).toEqual([]);
  });

  it('findByIdAndUserId() devuelve la estrategia si pertenece al usuario', async () => {
    const id = await insertStrategy({ userId: userIdA, name: 'Test por id', weights: WEIGHTS_B, factorEscala: 99, isSelected: false });

    const strategy = await repo.findByIdAndUserId(id, userIdA);

    expect(strategy).not.toBeNull();
    expect(strategy!.id).toBe(id);
  });

  it('findByIdAndUserId() devuelve null si la estrategia pertenece a otro usuario', async () => {
    const id = await insertStrategy({ userId: userIdB, name: 'De otro usuario', weights: WEIGHTS_B, factorEscala: 99, isSelected: false });

    const strategy = await repo.findByIdAndUserId(id, userIdA);

    expect(strategy).toBeNull();
  });

  it('findById() devuelve la estrategia por id, sin filtrar por usuario', async () => {
    const id = await insertStrategy({ userId: userIdA, name: 'Test por id', weights: WEIGHTS_B, factorEscala: 99, isSelected: false });

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

  describe('selectStrategy()', () => {
    it('desmarca la anterior y marca la nueva en una transacción, acotado al usuario', async () => {
      const idA = await insertStrategy({ userId: userIdA, name: 'Test A (seleccionada)', weights: WEIGHTS_A, factorEscala: 10, isSelected: true });
      const idB = await insertStrategy({ userId: userIdA, name: 'Test B (no seleccionada)', weights: WEIGHTS_B, factorEscala: 20, isSelected: false });

      await repo.selectStrategy(userIdA, idB);

      const a = await repo.findById(idA);
      const b = await repo.findById(idB);

      expect(a!.isSelected).toBe(false);
      expect(b!.isSelected).toBe(true);
    });

    it('no afecta la estrategia seleccionada de otro usuario', async () => {
      const idOfB = await insertStrategy({ userId: userIdB, name: 'De B (seleccionada)', weights: WEIGHTS_B, factorEscala: 20, isSelected: true });
      const idA1 = await insertStrategy({ userId: userIdA, name: 'De A (1)', weights: WEIGHTS_A, factorEscala: 10, isSelected: true });
      const idA2 = await insertStrategy({ userId: userIdA, name: 'De A (2)', weights: WEIGHTS_A, factorEscala: 10, isSelected: false });

      await repo.selectStrategy(userIdA, idA2);

      const bStillSelected = await repo.findById(idOfB);
      expect(bStillSelected!.isSelected).toBe(true);
      expect((await repo.findById(idA1))!.isSelected).toBe(false);
      expect((await repo.findById(idA2))!.isSelected).toBe(true);
    });

    it('lanza StrategyNotFoundError para id inexistente', async () => {
      await expect(
        repo.selectStrategy(userIdA, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(StrategyNotFoundError);
    });

    it('lanza StrategyNotFoundError si el id existe pero pertenece a otro usuario', async () => {
      const idOfB = await insertStrategy({ userId: userIdB, name: 'De B', weights: WEIGHTS_B, factorEscala: 20, isSelected: true });

      await expect(repo.selectStrategy(userIdA, idOfB)).rejects.toThrow(StrategyNotFoundError);
    });
  });

  describe('migration SeedPositionWeightProfiles (014-position-weight-profiles, US3)', () => {
    const POSITIONS = ['FW', 'MF', 'DF', 'GK'] as const;

    const sumOf = (weights: Record<string, number>) =>
      Object.values(weights).reduce((acc, w) => acc + w, 0);

    let strategyIdA: string;
    let strategyIdB: string;

    beforeEach(async () => {
      strategyIdA = await insertStrategy({ userId: userIdA, name: 'Performance general', weights: WEIGHTS_A, factorEscala: 99, isSelected: false });
      strategyIdB = await insertStrategy({ userId: userIdA, name: 'Impacto táctico', weights: WEIGHTS_B, factorEscala: 99, isSelected: false });

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        // La migration original referencia los dos ids fijos del seed de sistema de
        // 012; para ejercitar su UPDATE sobre filas por-usuario, apuntamos esos
        // mismos UPDATE a los ids recién insertados.
        await queryRunner.query(
          `UPDATE "valuation_strategies" SET "position_weights" = '{
            "FW": {"goals":0.45,"shots":0.25,"assists":0.15,"rating":0.15},
            "MF": {"assists":0.30,"keyPasses":0.30,"dribbles":0.15,"rating":0.25},
            "DF": {"totalTackles":0.40,"interceptions":0.25,"rating":0.25,"passesCompleted":0.10},
            "GK": {"rating":0.50,"passesCompleted":0.30,"interceptions":0.20}
          }' WHERE "id" = $1`,
          [strategyIdA],
        );
        await queryRunner.query(
          `UPDATE "valuation_strategies" SET "position_weights" = '{
            "FW": {"goals":0.45,"shots":0.25,"assists":0.15,"rating":0.20,"yellowCards":-0.05},
            "MF": {"assists":0.25,"keyPasses":0.25,"passesCompleted":0.20,"rating":0.20,"totalTackles":0.10},
            "DF": {"totalTackles":0.40,"interceptions":0.35,"rating":0.25},
            "GK": {"rating":0.50,"passesCompleted":0.35,"interceptions":0.15}
          }' WHERE "id" = $1`,
          [strategyIdB],
        );
      } finally {
        await queryRunner.release();
      }
    });

    it('carga los 4 perfiles de posición de "Performance general", cada uno sumando 1.0 ±0.001', async () => {
      const strategy = await repo.findById(strategyIdA);

      expect(strategy).not.toBeNull();
      for (const position of POSITIONS) {
        const profile = strategy!.positionWeights[position];
        expect(profile).toBeDefined();
        expect(sumOf(profile!)).toBeCloseTo(1.0, 3);
      }
      expect(strategy!.positionWeights.FW).toEqual({
        goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.15,
      });
      expect(strategy!.positionWeights.GK).toEqual({
        rating: 0.50, passesCompleted: 0.30, interceptions: 0.20,
      });
    });

    it('carga los 4 perfiles de posición de "Impacto táctico", cada uno sumando 1.0 ±0.001', async () => {
      const strategy = await repo.findById(strategyIdB);

      expect(strategy).not.toBeNull();
      for (const position of POSITIONS) {
        const profile = strategy!.positionWeights[position];
        expect(profile).toBeDefined();
        expect(sumOf(profile!)).toBeCloseTo(1.0, 3);
      }
      expect(strategy!.positionWeights.FW).toEqual({
        goals: 0.45, shots: 0.25, assists: 0.15, rating: 0.20, yellowCards: -0.05,
      });
      expect(strategy!.positionWeights.DF).toEqual({
        totalTackles: 0.40, interceptions: 0.35, rating: 0.25,
      });
    });

    it('la migration SeedPositionWeightProfiles.down() revierte position_weights a NULL', async () => {
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        await queryRunner.query(
          `UPDATE "valuation_strategies" SET "position_weights" = NULL WHERE "id" IN ($1, $2)`,
          [strategyIdA, strategyIdB],
        );
      } finally {
        await queryRunner.release();
      }

      const a = await repo.findById(strategyIdA);
      const b = await repo.findById(strategyIdB);
      expect(a!.positionWeights).toEqual({});
      expect(b!.positionWeights).toEqual({});
    });
  });

  it('save() persiste una nueva estrategia y devuelve el dominio con id asignado', async () => {
    const entity = dataSource.getRepository(ValuationStrategyEntity).create({
      userId: userIdA,
      name: 'Test save',
      weights: WEIGHTS_A,
      factorEscala: '15.0000',
      isSelected: false,
    });
    const saved = await dataSource.getRepository(ValuationStrategyEntity).save(entity);
    const mapper = moduleRef.get(ValuationStrategyMapper);
    const domain = mapper.toDomain(saved);

    expect(domain.id).toBeDefined();
    expect(domain.userId).toBe(userIdA);
    expect(domain.factorEscala).toBe(15);
    expect(domain.weights).toMatchObject(WEIGHTS_A);
  });

  it('saveMany() persiste el par de estrategias como una unidad atómica', async () => {
    const { ValuationStrategy } = await import('../../../domain/quotation/valuation-strategy');
    const a = ValuationStrategy.create({
      id: randomUUID(), userId: userIdA, name: 'Par A', weights: { goals: 1 }, factorEscala: 10, isSelected: true,
    });
    const b = ValuationStrategy.create({
      id: randomUUID(), userId: userIdA, name: 'Par B', weights: { assists: 1 }, factorEscala: 10, isSelected: false,
    });

    const saved = await repo.saveMany([a, b]);

    expect(saved).toHaveLength(2);
    const found = await repo.findByUserId(userIdA);
    expect(found.map((s) => s.name).sort()).toEqual(['Par A', 'Par B']);
  });
});

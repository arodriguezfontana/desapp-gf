import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { UserEntity } from '../../repositories/auth/entities/user.entity';
import { TokenHoldingEntity } from '../../repositories/portfolio/entities/token-holding.entity';
import { TokenTransactionEntity } from '../../repositories/orders/entities/token-transaction.entity';
import { DatabaseModule } from '../database.module';
import { backfillTokenBalances } from './backfill-token-balances';

/**
 * 030-token-balance-snapshot, US3: el backfill completa los saldos de los asientos anteriores a la
 * feature, tenencia por tenencia, validando contra el saldo real. Este spec vive fuera de
 * `database/migrations/` a propósito (el runner carga todo ese directorio). La base es la efímera
 * de Testcontainers; el esquema lo crea `synchronize` a partir de las entidades.
 */
describe('backfillTokenBalances (integration, spec 030)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;

  const day = (n: number) => new Date(Date.UTC(2026, 0, n));
  type Entry = { type: 'CREDIT' | 'DEBIT'; quantity: number; at: Date; before?: number; after?: number };

  const insertUser = async (username: string): Promise<string> => {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "users" (id, email, password_hash, username) VALUES ($1, $2, 'hash-backfill', $3)`,
      [id, `${id}@mail.com`, username],
    );
    return id;
  };

  const insertHolding = (userId: string, playerId: string, quantity: number) =>
    dataSource.query(
      `INSERT INTO "token_holdings" (id, user_id, player_id, quantity, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [randomUUID(), userId, playerId, quantity],
    );

  const insertEntries = async (userId: string, playerId: string, entries: Entry[]): Promise<string[]> => {
    const ids: string[] = [];
    for (const entry of entries) {
      const id = randomUUID();
      ids.push(id);
      await dataSource.query(
        `INSERT INTO "token_transactions"
           (id, user_id, type, player_id, quantity, price, order_id, counterpart_order_id, created_at, balance_before, balance_after)
         VALUES ($1, $2, $3, $4, $5, 10.00, $6, $7, $8, $9, $10)`,
        [
          id,
          userId,
          entry.type,
          playerId,
          entry.quantity,
          randomUUID(),
          randomUUID(),
          entry.at,
          entry.before ?? null,
          entry.after ?? null,
        ],
      );
    }
    return ids;
  };

  const balancesOf = async (ids: string[]) => {
    const rows = (await dataSource.query(
      `SELECT id, balance_before AS before, balance_after AS after FROM "token_transactions" WHERE id = ANY($1)`,
      [ids],
    )) as Array<{ id: string; before: number | null; after: number | null }>;
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => ({ before: byId.get(id)!.before, after: byId.get(id)!.after }));
  };

  /** Todas las columnas del asiento salvo los dos saldos, para comprobar que nada más cambia. */
  const nonBalanceSnapshot = async () =>
    dataSource.query(
      `SELECT id, user_id, type, player_id, quantity, price, order_id, counterpart_order_id, created_at
         FROM "token_transactions" ORDER BY id`,
    );

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([UserEntity, TokenHoldingEntity, TokenTransactionEntity]),
      ],
    }).compile();
    dataSource = moduleRef.get(DataSource);
    // El backfill opera sobre asientos legados (saldos NULL). Como la entidad los declara NOT NULL
    // (paso 2), se relajan acá y se restauran al terminar, para no afectar a las demás suites.
    await dataSource.query('DELETE FROM "token_transactions"');
    await dataSource.query('ALTER TABLE "token_transactions" ALTER COLUMN "balance_before" DROP NOT NULL');
    await dataSource.query('ALTER TABLE "token_transactions" ALTER COLUMN "balance_after" DROP NOT NULL');
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM "token_transactions"');
    await dataSource.query('ALTER TABLE "token_transactions" ALTER COLUMN "balance_before" SET NOT NULL');
    await dataSource.query('ALTER TABLE "token_transactions" ALTER COLUMN "balance_after" SET NOT NULL');
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "token_transactions"');
    await dataSource.query('DELETE FROM "token_holdings"');
    await dataSource.query('DELETE FROM "users"');
  });

  const P1 = randomUUID();
  const P2 = randomUUID();

  it('completa cada cadena con los valores exactos y el último saldo coincide con la tenencia', async () => {
    const a = await insertUser('alice');
    const b = await insertUser('bruno');
    await insertHolding(a, P1, 11);
    await insertHolding(b, P2, 3);
    const aIds = await insertEntries(a, P1, [
      { type: 'DEBIT', quantity: 4, at: day(2) },
      { type: 'CREDIT', quantity: 10, at: day(1) },
      { type: 'CREDIT', quantity: 5, at: day(3) },
    ]);
    const bIds = await insertEntries(b, P2, [
      { type: 'CREDIT', quantity: 5, at: day(1) },
      { type: 'DEBIT', quantity: 2, at: day(2) },
    ]);

    const report = await backfillTokenBalances(dataSource);

    expect(await balancesOf(aIds)).toEqual([
      { before: 10, after: 6 }, // DEBIT 4 (día 2)
      { before: 0, after: 10 }, // CREDIT 10 (día 1)
      { before: 6, after: 11 }, // CREDIT 5 (día 3)
    ]);
    expect(await balancesOf(bIds)).toEqual([
      { before: 0, after: 5 },
      { before: 5, after: 3 },
    ]);
    expect(report).toMatchObject({ holdings: 2, applied: 2, alreadyComplete: 0, inconsistent: [], updatedEntries: 5 });
  });

  it('no sobrescribe: un asiento que ya tenía saldos conserva los suyos (tenencia mixta con asientos nuevos)', async () => {
    const e = await insertUser('esteban');
    await insertHolding(e, P1, 9);
    const legacy = await insertEntries(e, P1, [
      { type: 'CREDIT', quantity: 10, at: day(1) },
      { type: 'DEBIT', quantity: 3, at: day(2) },
    ]);
    const fresh = await insertEntries(e, P1, [{ type: 'CREDIT', quantity: 2, at: day(3), before: 7, after: 9 }]);

    const report = await backfillTokenBalances(dataSource);

    expect(await balancesOf(legacy)).toEqual([
      { before: 0, after: 10 },
      { before: 10, after: 7 },
    ]);
    expect(await balancesOf(fresh)).toEqual([{ before: 7, after: 9 }]);
    expect(report).toMatchObject({ applied: 1, updatedEntries: 2, inconsistent: [] });
  });

  it('es idempotente: una segunda corrida lo reporta todo como ya completo y no cambia ninguna fila', async () => {
    const a = await insertUser('alice2');
    await insertHolding(a, P1, 5);
    const ids = await insertEntries(a, P1, [{ type: 'CREDIT', quantity: 5, at: day(1) }]);
    await backfillTokenBalances(dataSource);
    const afterFirst = await balancesOf(ids);
    const nonBalanceAfterFirst = await nonBalanceSnapshot();

    const second = await backfillTokenBalances(dataSource);

    expect(second).toMatchObject({ holdings: 1, applied: 0, alreadyComplete: 1, updatedEntries: 0, inconsistent: [] });
    expect(await balancesOf(ids)).toEqual(afterFirst);
    expect(await nonBalanceSnapshot()).toEqual(nonBalanceAfterFirst);
  });

  it('una tenencia inconsistente queda sin tocar y reportada; las sanas sí se completan en la misma corrida', async () => {
    const sana = await insertUser('sana');
    const rota = await insertUser('rota');
    await insertHolding(sana, P1, 5);
    await insertHolding(rota, P1, 99); // el historial sólo explica 5: apertura 94
    const sanaIds = await insertEntries(sana, P1, [{ type: 'CREDIT', quantity: 5, at: day(1) }]);
    const rotaIds = await insertEntries(rota, P1, [{ type: 'CREDIT', quantity: 5, at: day(1) }]);

    const report = await backfillTokenBalances(dataSource);

    expect(await balancesOf(sanaIds)).toEqual([{ before: 0, after: 5 }]);
    expect(await balancesOf(rotaIds)).toEqual([{ before: null, after: null }]);
    expect(report.applied).toBe(1);
    expect(report.inconsistent).toEqual([
      { userId: rota, playerId: P1, reason: 'opening-mismatch', opening: 94, net: 5, closingBalance: 99 },
    ]);
  });

  it('una tenencia sin fila en token_holdings cierra contra saldo 0', async () => {
    const u = await insertUser('sin-tenencia');
    const ids = await insertEntries(u, P1, [
      { type: 'CREDIT', quantity: 5, at: day(1) },
      { type: 'DEBIT', quantity: 5, at: day(2) },
    ]);

    const report = await backfillTokenBalances(dataSource);

    expect(await balancesOf(ids)).toEqual([
      { before: 0, after: 5 },
      { before: 5, after: 0 },
    ]);
    expect(report.inconsistent).toEqual([]);
  });

  it('el superusuario con emisión histórica no auditada se completa con apertura 100', async () => {
    const su = await insertUser('superuser');
    await insertHolding(su, P1, 93);
    const ids = await insertEntries(su, P1, [
      { type: 'DEBIT', quantity: 10, at: day(1) },
      { type: 'CREDIT', quantity: 3, at: day(2) },
    ]);

    const report = await backfillTokenBalances(dataSource);

    expect(await balancesOf(ids)).toEqual([
      { before: 100, after: 90 },
      { before: 90, after: 93 },
    ]);
    expect(report.inconsistent).toEqual([]);
    expect(report.details.find((d) => d.userId === su)).toMatchObject({ outcome: 'applied', opening: 100 });
  });

  it('el mismo caso en un usuario común es una inconsistencia', async () => {
    const u = await insertUser('no-superuser');
    await insertHolding(u, P1, 93);
    await insertEntries(u, P1, [
      { type: 'DEBIT', quantity: 10, at: day(1) },
      { type: 'CREDIT', quantity: 3, at: day(2) },
    ]);

    const report = await backfillTokenBalances(dataSource);

    expect(report.applied).toBe(0);
    expect(report.inconsistent).toHaveLength(1);
  });

  it('dryRun calcula y reporta pero no escribe nada', async () => {
    const a = await insertUser('dry');
    await insertHolding(a, P1, 5);
    const ids = await insertEntries(a, P1, [{ type: 'CREDIT', quantity: 5, at: day(1) }]);

    const report = await backfillTokenBalances(dataSource, { dryRun: true });

    expect(await balancesOf(ids)).toEqual([{ before: null, after: null }]);
    expect(report).toMatchObject({ applied: 1, updatedEntries: 0, inconsistent: [] });
    expect(report.details[0]).toMatchObject({ outcome: 'applied', dryRun: true });
  });

  it('no crea ni borra asientos y no cambia ningún campo distinto de los dos saldos', async () => {
    const a = await insertUser('intacto');
    const b = await insertUser('intacto-roto');
    await insertHolding(a, P1, 8);
    await insertHolding(b, P1, 50);
    await insertEntries(a, P1, [
      { type: 'CREDIT', quantity: 10, at: day(1) },
      { type: 'DEBIT', quantity: 2, at: day(2) },
    ]);
    await insertEntries(b, P1, [{ type: 'CREDIT', quantity: 1, at: day(1) }]);
    const before = await nonBalanceSnapshot();

    await backfillTokenBalances(dataSource);

    expect(await nonBalanceSnapshot()).toEqual(before);
  });

  it('una base sin asientos termina sin cambios ni errores', async () => {
    const report = await backfillTokenBalances(dataSource);

    expect(report).toMatchObject({ holdings: 0, applied: 0, alreadyComplete: 0, inconsistent: [], updatedEntries: 0 });
  });
});

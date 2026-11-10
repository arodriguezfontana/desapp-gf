import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { QueryRunner } from 'typeorm';
import { EnforceTokenTransactionBalances1793100000001 } from './migrations/1793100000001-EnforceTokenTransactionBalances';

/**
 * 030-token-balance-snapshot, paso 2: la migración sólo endurece a NOT NULL si el backfill cubrió
 * el 100% de las filas. Vive FUERA de `database/migrations/` a propósito. Se trabaja en un esquema
 * descartable con la tabla en el estado del paso 1 (columnas de saldo nullable).
 */
describe('EnforceTokenTransactionBalances (migration, spec 030 paso 2)', () => {
  const SCHEMA = 'snapshot_enforce_test';
  const migration = new EnforceTokenTransactionBalances1793100000001();
  let client: Client;
  const queryRunner = { query: (sql: string) => client.query(sql).then((r) => r.rows) } as unknown as QueryRunner;

  const nullable = async (column: string): Promise<boolean> => {
    const { rows } = await client.query(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'token_transactions' AND column_name = $2`,
      [SCHEMA, column],
    );
    return rows[0].is_nullable === 'YES';
  };

  const insertRow = (before: number | null, after: number | null) =>
    client.query(
      `INSERT INTO "token_transactions"
         (id, user_id, type, player_id, quantity, price, order_id, counterpart_order_id, created_at, balance_before, balance_after)
       VALUES ($1, $2, 'CREDIT', $3, 5, 10.00, $4, $5, now(), $6, $7)`,
      [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID(), before, after],
    );

  const createTable = async () => {
    await client.query(`DROP TABLE IF EXISTS "token_transactions"`);
    await client.query(`
      CREATE TABLE "token_transactions" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "type" varchar(6) NOT NULL,
        "player_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "order_id" uuid,
        "counterpart_order_id" uuid,
        "created_at" timestamptz NOT NULL,
        "balance_before" integer,
        "balance_after" integer
      )
    `);
  };

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCHEMA}`);
    await client.query(`SET search_path TO ${SCHEMA}`);
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.end();
  });

  beforeEach(createTable);

  it('con algún saldo vacío falla con un mensaje que apunta al backfill y no cambia el esquema', async () => {
    await insertRow(0, 5);
    await insertRow(null, null);

    await expect(migration.up(queryRunner)).rejects.toThrow(/db:backfill-token-balances/);

    expect(await nullable('balance_before')).toBe(true);
    expect(await nullable('balance_after')).toBe(true);
  });

  it('también falla si sólo uno de los dos saldos está vacío', async () => {
    await insertRow(0, null);

    await expect(migration.up(queryRunner)).rejects.toThrow(/1 asiento/);
  });

  it('sin saldos vacíos los vuelve NOT NULL y conserva las filas', async () => {
    await insertRow(0, 5);
    await insertRow(5, 10);

    await migration.up(queryRunner);

    expect(await nullable('balance_before')).toBe(false);
    expect(await nullable('balance_after')).toBe(false);
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM "token_transactions"`);
    expect(rows[0].n).toBe(2);
    await expect(insertRow(null, null)).rejects.toThrow();
  });

  it('con la tabla vacía aplica sin problema y es idempotente', async () => {
    await migration.up(queryRunner);

    await expect(migration.up(queryRunner)).resolves.toBeUndefined();
    expect(await nullable('balance_before')).toBe(false);
  });

  it('down los vuelve a permitir vacíos', async () => {
    await migration.up(queryRunner);

    await migration.down(queryRunner);

    expect(await nullable('balance_before')).toBe(true);
    expect(await nullable('balance_after')).toBe(true);
  });
});

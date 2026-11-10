import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { QueryRunner } from 'typeorm';
import { AddBalanceSnapshotToTokenTransactions1793100000000 } from './migrations/1793100000000-AddBalanceSnapshotToTokenTransactions';

/**
 * 030-token-balance-snapshot: migración de esquema de producción (sin `synchronize`).
 * Este spec vive FUERA de `database/migrations/` a propósito: el runner carga todo
 * `migrations/*.{ts,js}` y un spec ahí se ejecutaría como migration.
 *
 * Se trabaja en un esquema descartable (`snapshot_migration_test`) con la tabla en su estado
 * previo a la feature, para no tocar la tabla que crea `synchronize` para el resto de las suites.
 */
describe('AddBalanceSnapshotToTokenTransactions (migration, spec 030)', () => {
  const SCHEMA = 'snapshot_migration_test';
  const migration = new AddBalanceSnapshotToTokenTransactions1793100000000();
  let client: Client;

  const queryRunner = { query: (sql: string) => client.query(sql) } as unknown as QueryRunner;

  const columns = async (): Promise<Record<string, { nullable: boolean; type: string }>> => {
    const { rows } = await client.query(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'token_transactions'`,
      [SCHEMA],
    );
    return Object.fromEntries(
      rows.map((r) => [r.column_name, { nullable: r.is_nullable === 'YES', type: r.data_type }]),
    );
  };

  const insertLegacyRow = async (): Promise<string> => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO "token_transactions"
         (id, user_id, type, player_id, quantity, price, order_id, counterpart_order_id, created_at)
       VALUES ($1, $2, 'CREDIT', $3, 5, 10.00, $4, $5, now())`,
      [id, randomUUID(), randomUUID(), randomUUID(), randomUUID()],
    );
    return id;
  };

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCHEMA}`);
    await client.query(`SET search_path TO ${SCHEMA}`);
    // Estado previo a la feature (migración 1792040000004), sin FKs: acá no se prueban.
    await client.query(`
      CREATE TABLE "token_transactions" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "type" varchar(6) NOT NULL,
        "player_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "order_id" uuid NOT NULL,
        "counterpart_order_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL,
        CONSTRAINT "ck_token_transactions_quantity" CHECK ("quantity" > 0)
      )
    `);
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.end();
  });

  it('antes de la migración no existen las columnas de saldo y los ids de orden son obligatorios', async () => {
    const before = await columns();

    expect(before.balance_before).toBeUndefined();
    expect(before.balance_after).toBeUndefined();
    expect(before.order_id.nullable).toBe(false);
    expect(before.counterpart_order_id.nullable).toBe(false);
  });

  it('up agrega balance_before/balance_after (integer, nullable) y deja los ids de orden opcionales', async () => {
    const legacyId = await insertLegacyRow();

    await migration.up(queryRunner);

    const after = await columns();
    expect(after.balance_before).toEqual({ nullable: true, type: 'integer' });
    expect(after.balance_after).toEqual({ nullable: true, type: 'integer' });
    expect(after.order_id.nullable).toBe(true);
    expect(after.counterpart_order_id.nullable).toBe(true);

    // La fila existente se conserva, con los saldos vacíos.
    const { rows } = await client.query(
      `SELECT balance_before, balance_after, quantity FROM "token_transactions" WHERE id = $1`,
      [legacyId],
    );
    expect(rows).toEqual([{ balance_before: null, balance_after: null, quantity: 5 }]);
  });

  it('permite un asiento de emisión (sin orden ni contraparte)', async () => {
    await expect(
      client.query(
        `INSERT INTO "token_transactions"
           (id, user_id, type, player_id, quantity, price, order_id, counterpart_order_id, created_at, balance_before, balance_after)
         VALUES ($1, $2, 'CREDIT', $3, 100, 10.00, NULL, NULL, now(), 0, 100)`,
        [randomUUID(), randomUUID(), randomUUID()],
      ),
    ).resolves.toBeDefined();
  });

  it('es idempotente: correr up otra vez no falla ni cambia el esquema', async () => {
    const before = await columns();

    await expect(migration.up(queryRunner)).resolves.toBeUndefined();

    expect(await columns()).toEqual(before);
  });

  it('down quita las dos columnas de saldo y conserva el resto de las filas', async () => {
    const { rows: countBefore } = await client.query(`SELECT count(*)::int AS n FROM "token_transactions"`);

    await migration.down(queryRunner);

    const after = await columns();
    expect(after.balance_before).toBeUndefined();
    expect(after.balance_after).toBeUndefined();
    const { rows: countAfter } = await client.query(`SELECT count(*)::int AS n FROM "token_transactions"`);
    expect(countAfter[0].n).toBe(countBefore[0].n);
  });
});

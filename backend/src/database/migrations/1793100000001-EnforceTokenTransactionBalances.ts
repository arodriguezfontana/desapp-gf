import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 030-token-balance-snapshot, paso 2: vuelve obligatorios `balance_before` y `balance_after` de
 * `token_transactions`, de modo que no pueda existir ningun asiento sin ellos.
 *
 * Precondicion: los asientos anteriores a la feature ya se completaron con
 * `pnpm db:backfill-token-balances` (terminado con codigo 0). Si queda alguna fila con saldo
 * nulo, la migracion FALLA con un mensaje claro en lugar de aplicar el `NOT NULL` a medias:
 * exigir un dato que todavia no existe dejaria el esquema inconsistente.
 *
 * En desarrollo y tests el esquema sale de la entidad (`synchronize`) y esta migracion es un
 * no-op idempotente.
 */
export class EnforceTokenTransactionBalances1793100000001 implements MigrationInterface {
  name = 'EnforceTokenTransactionBalances1793100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ pending: number }> = await queryRunner.query(
      `SELECT count(*)::int AS pending FROM "token_transactions"
        WHERE "balance_before" IS NULL OR "balance_after" IS NULL`,
    );
    const pending = rows[0]?.pending ?? 0;
    if (pending > 0) {
      throw new Error(
        `Hay ${pending} asiento(s) de token_transactions sin saldo anterior/posterior. ` +
          'Corré "pnpm db:backfill-token-balances" hasta que termine con código 0 y reintentá.',
      );
    }
    await queryRunner.query(`ALTER TABLE "token_transactions" ALTER COLUMN "balance_before" SET NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "token_transactions" ALTER COLUMN "balance_after" SET NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "token_transactions" ALTER COLUMN "balance_after" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "token_transactions" ALTER COLUMN "balance_before" DROP NOT NULL;`);
  }
}

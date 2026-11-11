import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 030-token-balance-snapshot: agrega a `token_transactions` el saldo de la tenencia antes y
 * después de cada movimiento (`balance_before`, `balance_after`) y deja opcionales los ids de
 * orden, porque el asiento de emisión inicial no nace de ninguna orden ni tiene contraparte.
 *
 * Los saldos se agregan NULL-ables: los asientos anteriores se completan con
 * `pnpm db:backfill-token-balances` (script re-ejecutable, no una migración) y recién después,
 * en un paso aparte, se vuelven obligatorios.
 *
 * Producción corre sólo migraciones (sin `synchronize`); en desarrollo y tests el esquema sale de
 * la entidad `TokenTransactionEntity` y esta migración es un no-op idempotente (`IF NOT EXISTS`,
 * `DROP NOT NULL` repetible), igual que `CreateTokenTransactions`.
 */
export class AddBalanceSnapshotToTokenTransactions1793100000000 implements MigrationInterface {
  name = 'AddBalanceSnapshotToTokenTransactions1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "token_transactions" ADD COLUMN IF NOT EXISTS "balance_before" integer;`);
    await queryRunner.query(`ALTER TABLE "token_transactions" ADD COLUMN IF NOT EXISTS "balance_after" integer;`);
    await queryRunner.query(`ALTER TABLE "token_transactions" ALTER COLUMN "order_id" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "token_transactions" ALTER COLUMN "counterpart_order_id" DROP NOT NULL;`);
  }

  /**
   * Quita las columnas de saldo. `order_id`/`counterpart_order_id` se dejan opcionales: volver a
   * exigirlos fallaría si ya existe algún asiento de emisión.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "token_transactions" DROP COLUMN IF EXISTS "balance_after";`);
    await queryRunner.query(`ALTER TABLE "token_transactions" DROP COLUMN IF EXISTS "balance_before";`);
  }
}

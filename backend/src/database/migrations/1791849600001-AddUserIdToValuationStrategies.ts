import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega `user_id` a `valuation_strategies`: toda estrategia pasa a
 * pertenecer a exactamente un usuario (019-per-user-valuation-strategies,
 * spec FR-001/FR-003, data-model.md). Se asume que la migración anterior
 * (`DropLegacyGlobalStrategiesAndQuotes`) ya dejó la tabla sin filas
 * preexistentes, por lo que `NOT NULL` no requiere backfill.
 */
export class AddUserIdToValuationStrategies1791849600001 implements MigrationInterface {
  name = 'AddUserIdToValuationStrategies1791849600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "valuation_strategies"
        ADD COLUMN "user_id" uuid NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "valuation_strategies"
        ADD CONSTRAINT "fk_valuation_strategies_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_valuation_strategies_user_id"
        ON "valuation_strategies" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_valuation_strategies_user_id";`);
    await queryRunner.query(`
      ALTER TABLE "valuation_strategies" DROP CONSTRAINT IF EXISTS "fk_valuation_strategies_user";
    `);
    await queryRunner.query(`ALTER TABLE "valuation_strategies" DROP COLUMN IF EXISTS "user_id";`);
  }
}

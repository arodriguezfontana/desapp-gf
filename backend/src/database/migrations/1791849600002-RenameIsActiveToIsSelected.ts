import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renombra `is_active` → `is_selected` en `valuation_strategies`: deja de
 * significar "activa para todo el sistema" y pasa a significar "seleccionada
 * por su dueño" (019-per-user-valuation-strategies, research.md D1).
 */
export class RenameIsActiveToIsSelected1791849600002 implements MigrationInterface {
  name = 'RenameIsActiveToIsSelected1791849600002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_valuation_strategies_active";`);
    await queryRunner.query(`
      ALTER TABLE "valuation_strategies" RENAME COLUMN "is_active" TO "is_selected";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "valuation_strategies" RENAME COLUMN "is_selected" TO "is_active";
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_valuation_strategies_active"
        ON "valuation_strategies" ("is_active")
        WHERE "is_active" = true;
    `);
  }
}

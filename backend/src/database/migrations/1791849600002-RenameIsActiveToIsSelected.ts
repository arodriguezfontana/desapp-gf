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
    // Guard: en desarrollo `synchronize: true` ya puede haber creado la tabla
    // directamente con `is_selected` (a partir de la entidad actual), sin que
    // `is_active` haya existido nunca en esa base.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'valuation_strategies' AND column_name = 'is_active'
        ) THEN
          ALTER TABLE "valuation_strategies" RENAME COLUMN "is_active" TO "is_selected";
        END IF;
      END $$;
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

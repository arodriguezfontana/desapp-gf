import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice único parcial: a lo sumo una estrategia seleccionada por usuario,
 * blindado a nivel de base de datos (019-per-user-valuation-strategies,
 * data-model.md, FR-002/FR-005).
 */
export class AddUniqueSelectedIndex1791849600003 implements MigrationInterface {
  name = 'AddUniqueSelectedIndex1791849600003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_valuation_strategies_user_selected"
        ON "valuation_strategies" ("user_id")
        WHERE "is_selected" = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_valuation_strategies_user_selected";`);
  }
}

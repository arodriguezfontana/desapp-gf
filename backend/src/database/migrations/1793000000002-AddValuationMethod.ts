import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega `valuation_method` a `valuation_strategies` (método de cálculo de la
 * estrategia) y a `player_quotes` (snapshot del método con el que se produjo
 * cada cotización), spec 027. Las filas existentes quedan en `WEIGHTED`, el
 * método original, así que ningún precio ya calculado cambia.
 */
export class AddValuationMethod1793000000002 implements MigrationInterface {
  name = 'AddValuationMethod1793000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "valuation_strategies"
        ADD COLUMN IF NOT EXISTS "valuation_method" varchar(20) NOT NULL DEFAULT 'WEIGHTED';
    `);
    await queryRunner.query(`
      ALTER TABLE "player_quotes"
        ADD COLUMN IF NOT EXISTS "valuation_method" varchar(20) NOT NULL DEFAULT 'WEIGHTED';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "player_quotes" DROP COLUMN IF EXISTS "valuation_method";`);
    await queryRunner.query(`ALTER TABLE "valuation_strategies" DROP COLUMN IF EXISTS "valuation_method";`);
  }
}

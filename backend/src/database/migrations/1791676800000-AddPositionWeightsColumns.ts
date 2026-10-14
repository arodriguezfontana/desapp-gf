import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega las columnas que soportan perfiles de pesos por posición
 * (014-position-weight-profiles, data-model.md):
 * - `valuation_strategies.position_weights`: jsonb opcional, mapa
 *   posición → (mapa métrica → peso).
 * - `player_quotes.applied_position`: varchar(2) opcional, indica si el
 *   snapshot de la cotización corresponde al perfil de esa posición o a los
 *   pesos generales (`NULL`).
 */
export class AddPositionWeightsColumns1791676800000 implements MigrationInterface {
  name = 'AddPositionWeightsColumns1791676800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: idempotente ante reintentos de migration sobre la misma base
    // (p. ej. un Testcontainers Postgres compartido entre corridas de test e2e).
    await queryRunner.query(`
      ALTER TABLE "valuation_strategies" ADD COLUMN IF NOT EXISTS "position_weights" jsonb NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "player_quotes" ADD COLUMN IF NOT EXISTS "applied_position" varchar(2) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "player_quotes" DROP COLUMN IF EXISTS "applied_position";
    `);
    await queryRunner.query(`
      ALTER TABLE "valuation_strategies" DROP COLUMN IF EXISTS "position_weights";
    `);
  }
}

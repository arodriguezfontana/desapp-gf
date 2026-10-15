import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elimina las filas seed globales de `valuation_strategies` (y los
 * `player_quotes` que las referencian) de 012-valuation-strategies /
 * 014-position-weight-profiles, antes de endurecer el esquema a "toda
 * estrategia pertenece a exactamente un usuario"
 * (019-per-user-valuation-strategies, spec FR-020, research.md D2).
 *
 * La migración o el destino de esos datos queda explícitamente fuera de
 * alcance (spec.md §Assumptions): el único camino para repoblar ambas
 * tablas pasa a ser el provisioning por usuario de esta feature.
 */
export class DropLegacyGlobalStrategiesAndQuotes1791849600000 implements MigrationInterface {
  name = 'DropLegacyGlobalStrategiesAndQuotes1791849600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "player_quotes"
      WHERE "strategy_id" IN (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'b2c3d4e5-f6a7-8901-bcde-f12345678901'
      );
    `);

    await queryRunner.query(`
      DELETE FROM "valuation_strategies"
      WHERE "id" IN (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'b2c3d4e5-f6a7-8901-bcde-f12345678901'
      );
    `);
  }

  public async down(): Promise<void> {
    // Irreversible a propósito: la migración o el destino de estos datos
    // quedó fuera de alcance de la feature (spec.md §Assumptions).
  }
}

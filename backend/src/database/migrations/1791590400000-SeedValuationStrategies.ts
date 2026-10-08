import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inserta las dos estrategias de valuación iniciales para la feature
 * 012-valuation-strategies (spec FR-015, data-model.md §Seed data).
 *
 * Los pesos usan los nombres de campo del dominio Player: `shots` (no `totalShots`)
 * y `passesCompleted` (no `accuratePasses`) — research.md §2.
 *
 * `ON CONFLICT (id) DO NOTHING` hace la migration idempotente.
 */
export class SeedValuationStrategies1791590400000 implements MigrationInterface {
  name = 'SeedValuationStrategies1791590400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "valuation_strategies" ("id", "name", "weights", "factor_escala", "is_active") VALUES
        (
          'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          'Performance general',
          '{"goals":0.25,"assists":0.15,"shots":0.10,"keyPasses":0.10,"dribbles":0.10,"totalTackles":0.10,"rating":0.20}',
          99.0000,
          true
        ),
        (
          'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          'Impacto táctico',
          '{"totalTackles":0.25,"interceptions":0.20,"passesCompleted":0.20,"assists":0.20,"keyPasses":0.15,"rating":0.20,"yellowCards":-0.05,"redCards":-0.15}',
          99.0000,
          false
        )
      ON CONFLICT ("id") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "valuation_strategies"
      WHERE "id" IN (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'b2c3d4e5-f6a7-8901-bcde-f12345678901'
      );
    `);
  }
}

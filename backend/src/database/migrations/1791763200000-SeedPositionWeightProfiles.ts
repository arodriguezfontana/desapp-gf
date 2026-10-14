import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Carga los perfiles de pesos por posición (FW/MF/DF/GK) de las dos
 * estrategias seedeadas por 012-valuation-strategies
 * (014-position-weight-profiles, spec FR-007, data-model.md §Seed data).
 *
 * Usa los nombres de campo del dominio Player: `shots` (no `totalShots`) y
 * `passesCompleted` (no `accuratePasses`) — research.md Decisión 1, mismo
 * criterio que `SeedValuationStrategies1791590400000`.
 */
export class SeedPositionWeightProfiles1791763200000 implements MigrationInterface {
  name = 'SeedPositionWeightProfiles1791763200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "valuation_strategies" SET "position_weights" = '{
        "FW": {"goals":0.45,"shots":0.25,"assists":0.15,"rating":0.15},
        "MF": {"assists":0.30,"keyPasses":0.30,"dribbles":0.15,"rating":0.25},
        "DF": {"totalTackles":0.40,"interceptions":0.25,"rating":0.25,"passesCompleted":0.10},
        "GK": {"rating":0.50,"passesCompleted":0.30,"interceptions":0.20}
      }'
      WHERE "id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    `);

    await queryRunner.query(`
      UPDATE "valuation_strategies" SET "position_weights" = '{
        "FW": {"goals":0.45,"shots":0.25,"assists":0.15,"rating":0.20,"yellowCards":-0.05},
        "MF": {"assists":0.25,"keyPasses":0.25,"passesCompleted":0.20,"rating":0.20,"totalTackles":0.10},
        "DF": {"totalTackles":0.40,"interceptions":0.35,"rating":0.25},
        "GK": {"rating":0.50,"passesCompleted":0.35,"interceptions":0.15}
      }'
      WHERE "id" = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "valuation_strategies" SET "position_weights" = NULL
      WHERE "id" IN (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'b2c3d4e5-f6a7-8901-bcde-f12345678901'
      );
    `);
  }
}

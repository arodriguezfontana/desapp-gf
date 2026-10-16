import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Provisiona las dos estrategias default a todo usuario que ya existía
 * antes de 019-per-user-valuation-strategies y por lo tanto nunca pasó por
 * `UserStrategyProvisioningService` (ese servicio solo corre en el alta y en
 * el seed del admin, no retroactivamente). Mismos valores exactos que
 * `UserStrategyProvisioningService` (data-model.md §Datos seed por usuario).
 *
 * Idempotente: solo inserta para usuarios con 0 filas en valuation_strategies.
 */
export class BackfillDefaultStrategiesForExistingUsers1792040000000 implements MigrationInterface {
  name = 'BackfillDefaultStrategiesForExistingUsers1792040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "valuation_strategies" ("user_id", "name", "weights", "position_weights", "factor_escala", "is_selected")
      SELECT u.id, 'Performance general',
        '{"goals":0.25,"assists":0.15,"shots":0.10,"keyPasses":0.10,"dribbles":0.10,"totalTackles":0.10,"rating":0.20}'::jsonb,
        '{
          "FW": {"goals":0.45,"shots":0.25,"assists":0.15,"rating":0.15},
          "MF": {"assists":0.30,"keyPasses":0.30,"dribbles":0.15,"rating":0.25},
          "DF": {"totalTackles":0.40,"interceptions":0.25,"rating":0.25,"passesCompleted":0.10},
          "GK": {"rating":0.50,"passesCompleted":0.30,"interceptions":0.20}
        }'::jsonb,
        99.0000,
        true
      FROM "users" u
      WHERE NOT EXISTS (
        SELECT 1 FROM "valuation_strategies" vs WHERE vs."user_id" = u.id
      );
    `);

    await queryRunner.query(`
      INSERT INTO "valuation_strategies" ("user_id", "name", "weights", "position_weights", "factor_escala", "is_selected")
      SELECT u.id, 'Impacto táctico',
        '{"totalTackles":0.25,"interceptions":0.20,"passesCompleted":0.20,"assists":0.20,"keyPasses":0.15,"rating":0.20,"yellowCards":-0.05,"redCards":-0.15}'::jsonb,
        '{
          "FW": {"goals":0.45,"shots":0.25,"assists":0.15,"rating":0.20,"yellowCards":-0.05},
          "MF": {"assists":0.25,"keyPasses":0.25,"passesCompleted":0.20,"rating":0.20,"totalTackles":0.10},
          "DF": {"totalTackles":0.40,"interceptions":0.35,"rating":0.25},
          "GK": {"rating":0.50,"passesCompleted":0.35,"interceptions":0.15}
        }'::jsonb,
        99.0000,
        false
      FROM "users" u
      WHERE NOT EXISTS (
        SELECT 1 FROM "valuation_strategies" vs WHERE vs."user_id" = u.id AND vs."name" = 'Impacto táctico'
      );
    `);
  }

  public async down(): Promise<void> {
    // Irreversible a propósito: no hay forma de distinguir, después del
    // hecho, qué estrategias vinieron de este backfill vs. de un alta normal
    // posterior con los mismos valores.
  }
}

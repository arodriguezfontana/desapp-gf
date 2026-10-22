import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea `price_alerts` (025-player-price-alerts, data-model.md). Cada alerta
 * referencia un usuario y un jugador por FK; no hay restricción de unicidad
 * entre ellas (spec FR-003): un mismo usuario puede tener varias alertas
 * activas sobre el mismo jugador.
 */
export class CreatePriceAlerts1793000000000 implements MigrationInterface {
  name = 'CreatePriceAlerts1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "price_alerts" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "player_id" uuid NOT NULL,
        "condition" varchar(16) NOT NULL,
        "target_value" decimal(10,2) NOT NULL,
        "status" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL,
        "cancelled_at" timestamptz NULL,
        CONSTRAINT "ck_price_alerts_target_value" CHECK ("target_value" > 0)
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_price_alerts_user'
        ) THEN
          ALTER TABLE "price_alerts"
            ADD CONSTRAINT "fk_price_alerts_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_price_alerts_player'
        ) THEN
          ALTER TABLE "price_alerts"
            ADD CONSTRAINT "fk_price_alerts_player"
            FOREIGN KEY ("player_id") REFERENCES "players"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_price_alerts_user_player_status"
        ON "price_alerts" ("user_id", "player_id", "status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "price_alerts";`);
  }
}

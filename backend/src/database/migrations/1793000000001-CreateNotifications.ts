import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea `notifications` (025-player-price-alerts, data-model.md). Referencia
 * la `PriceAlert` que la disparó, el usuario destinatario y el jugador
 * (denormalizado para evitar join al listar, FR-013).
 */
export class CreateNotifications1793000000001 implements MigrationInterface {
  name = 'CreateNotifications1793000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "alert_id" uuid NOT NULL,
        "player_id" uuid NOT NULL,
        "condition" varchar(16) NOT NULL,
        "triggered_value" decimal(10,2) NOT NULL,
        "created_at" timestamptz NOT NULL,
        "read" boolean NOT NULL DEFAULT false
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_user'
        ) THEN
          ALTER TABLE "notifications"
            ADD CONSTRAINT "fk_notifications_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_alert'
        ) THEN
          ALTER TABLE "notifications"
            ADD CONSTRAINT "fk_notifications_alert"
            FOREIGN KEY ("alert_id") REFERENCES "price_alerts"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_player'
        ) THEN
          ALTER TABLE "notifications"
            ADD CONSTRAINT "fk_notifications_player"
            FOREIGN KEY ("player_id") REFERENCES "players"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_notifications_user_created_at"
        ON "notifications" ("user_id", "created_at" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications";`);
  }
}

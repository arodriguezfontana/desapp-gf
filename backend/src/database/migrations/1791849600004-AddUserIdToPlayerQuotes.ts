import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega `user_id` a `player_quotes`: el historial de cotizaciones pasa de
 * ser único por jugador para todo el sistema a ser por usuario
 * (019-per-user-valuation-strategies, spec DD-002, data-model.md). Se asume
 * que `DropLegacyGlobalStrategiesAndQuotes` ya dejó la tabla sin filas
 * preexistentes, por lo que `NOT NULL` no requiere backfill.
 */
export class AddUserIdToPlayerQuotes1791849600004 implements MigrationInterface {
  name = 'AddUserIdToPlayerQuotes1791849600004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: en desarrollo `synchronize: true` ya puede haber creado
    // esta columna a partir de la entidad antes de que corra esta migración.
    await queryRunner.query(`
      ALTER TABLE "player_quotes"
        ADD COLUMN IF NOT EXISTS "user_id" uuid NOT NULL;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_player_quotes_user'
        ) THEN
          ALTER TABLE "player_quotes"
            ADD CONSTRAINT "fk_player_quotes_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_player_quotes_player_date";`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_player_quotes_user_player_date"
        ON "player_quotes" ("user_id", "player_id", "calculated_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_player_quotes_user_player_date";`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_player_quotes_player_date"
        ON "player_quotes" ("player_id", "calculated_at" DESC);
    `);
    await queryRunner.query(`
      ALTER TABLE "player_quotes" DROP CONSTRAINT IF EXISTS "fk_player_quotes_user";
    `);
    await queryRunner.query(`ALTER TABLE "player_quotes" DROP COLUMN IF EXISTS "user_id";`);
  }
}

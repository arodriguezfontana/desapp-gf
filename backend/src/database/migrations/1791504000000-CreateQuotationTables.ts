import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea las tablas `valuation_strategies` y `player_quotes` para la feature
 * 012-valuation-strategies. En desarrollo/test el esquema lo crea `synchronize`
 * (database.module.ts); esta migration lo crea explícitamente en producción donde
 * `synchronize: false` (data-model.md, mismo patrón que CreateTeamsTable).
 */
export class CreateQuotationTables1791504000000 implements MigrationInterface {
  name = 'CreateQuotationTables1791504000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "valuation_strategies" (
        "id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
        "name"          varchar(120)  NOT NULL,
        "weights"       jsonb         NOT NULL,
        "factor_escala" DECIMAL(10,4) NOT NULL,
        "is_active"     boolean       NOT NULL DEFAULT false,
        "created_at"    timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "pk_valuation_strategies" PRIMARY KEY ("id")
      )
    `);

    // Guard: en una base fresca (Testcontainers/CI), `synchronize: true` ya crea
    // la tabla con el esquema actual (`is_selected`, 019-per-user-valuation-strategies)
    // antes de que corran las migraciones; ahí "is_active" nunca existió y este
    // índice histórico no aplica. En un entorno real con `synchronize: false`
    // donde esta migración corre contra el esquema de 012 tal cual era, la
    // columna sí existe y el índice se crea igual que siempre.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'valuation_strategies' AND column_name = 'is_active'
        ) THEN
          CREATE INDEX IF NOT EXISTS "idx_valuation_strategies_active"
            ON "valuation_strategies" ("is_active")
            WHERE "is_active" = true;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "player_quotes" (
        "id"                      uuid          NOT NULL DEFAULT gen_random_uuid(),
        "player_id"               uuid          NOT NULL,
        "strategy_id"             uuid          NOT NULL,
        "weight_snapshot"         jsonb         NOT NULL,
        "factor_escala_snapshot"  DECIMAL(10,4) NOT NULL,
        "score"                   DECIMAL(8,6)  NOT NULL,
        "value"                   DECIMAL(10,2) NOT NULL,
        "calculated_at"           timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "pk_player_quotes" PRIMARY KEY ("id"),
        CONSTRAINT "fk_player_quotes_player"   FOREIGN KEY ("player_id")   REFERENCES "players"("id"),
        CONSTRAINT "fk_player_quotes_strategy" FOREIGN KEY ("strategy_id") REFERENCES "valuation_strategies"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_player_quotes_player_date"
        ON "player_quotes" ("player_id", "calculated_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "player_quotes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "valuation_strategies"`);
  }
}

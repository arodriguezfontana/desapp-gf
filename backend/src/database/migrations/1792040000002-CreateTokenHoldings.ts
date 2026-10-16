import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea `token_holdings` (020-order-matching-engine, data-model.md —
 * construye desde cero la infraestructura de 017-buy-tokens, research.md D7).
 * Indice unico compuesto `(user_id, player_id)`: un holding por par.
 */
export class CreateTokenHoldings1792040000002 implements MigrationInterface {
  name = 'CreateTokenHoldings1792040000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_holdings" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "player_id" uuid NOT NULL,
        "quantity" integer NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL,
        CONSTRAINT "ck_token_holdings_quantity" CHECK ("quantity" >= 0)
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_token_holdings_user'
        ) THEN
          ALTER TABLE "token_holdings"
            ADD CONSTRAINT "fk_token_holdings_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_token_holdings_player'
        ) THEN
          ALTER TABLE "token_holdings"
            ADD CONSTRAINT "fk_token_holdings_player"
            FOREIGN KEY ("player_id") REFERENCES "players"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_token_holdings_user_player"
        ON "token_holdings" ("user_id", "player_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "token_holdings";`);
  }
}

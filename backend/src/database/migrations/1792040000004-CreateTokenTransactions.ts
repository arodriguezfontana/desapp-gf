import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea `token_transactions` (020-order-matching-engine, data-model.md).
 * Tabla append-only: ningun repositorio expone update/delete sobre ella
 * (constitucion, Principio V). FKs a `orders` (`order_id`,
 * `counterpart_order_id`).
 */
export class CreateTokenTransactions1792040000004 implements MigrationInterface {
  name = 'CreateTokenTransactions1792040000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_transactions" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "type" varchar(6) NOT NULL,
        "player_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "order_id" uuid NOT NULL,
        "counterpart_order_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL,
        CONSTRAINT "ck_token_transactions_quantity" CHECK ("quantity" > 0)
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_token_transactions_user'
        ) THEN
          ALTER TABLE "token_transactions"
            ADD CONSTRAINT "fk_token_transactions_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_token_transactions_player'
        ) THEN
          ALTER TABLE "token_transactions"
            ADD CONSTRAINT "fk_token_transactions_player"
            FOREIGN KEY ("player_id") REFERENCES "players"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_token_transactions_order'
        ) THEN
          ALTER TABLE "token_transactions"
            ADD CONSTRAINT "fk_token_transactions_order"
            FOREIGN KEY ("order_id") REFERENCES "orders"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_token_transactions_counterpart_order'
        ) THEN
          ALTER TABLE "token_transactions"
            ADD CONSTRAINT "fk_token_transactions_counterpart_order"
            FOREIGN KEY ("counterpart_order_id") REFERENCES "orders"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_token_transactions_user_player_created"
        ON "token_transactions" ("user_id", "player_id", "created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "token_transactions";`);
  }
}

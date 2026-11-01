import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea `orders` (020-order-matching-engine, data-model.md). El indice
 * compuesto `(player_id, side, price, status, created_at)` es exactamente el
 * criterio de busqueda de candidatas del motor de matching (mismo jugador,
 * lado opuesto, precio cruzado, status pendiente, mejor precio primero y FIFO
 * por created_at).
 */
export class CreateOrders1792040000003 implements MigrationInterface {
  name = 'CreateOrders1792040000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "player_id" uuid NOT NULL,
        "side" varchar(4) NOT NULL,
        "quantity" integer NOT NULL,
        "remaining_quantity" integer NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "status" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL,
        CONSTRAINT "ck_orders_quantity" CHECK ("quantity" > 0),
        CONSTRAINT "ck_orders_remaining_quantity" CHECK (
          "remaining_quantity" >= 0 AND "remaining_quantity" <= "quantity"
        )
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_user'
        ) THEN
          ALTER TABLE "orders"
            ADD CONSTRAINT "fk_orders_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_player'
        ) THEN
          ALTER TABLE "orders"
            ADD CONSTRAINT "fk_orders_player"
            FOREIGN KEY ("player_id") REFERENCES "players"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_orders_matching"
        ON "orders" ("player_id", "side", "price", "status", "created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "orders";`);
  }
}

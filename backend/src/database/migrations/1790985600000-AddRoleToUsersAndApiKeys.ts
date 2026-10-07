import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega la columna `role` a `users` y `api_keys` (spec 008, US1/US3/US4).
 *
 * Corre en el deploy a través de `runPlayerCatalogMigrations` (main.ts), porque
 * `synchronize` está apagado en producción. `IF NOT EXISTS` la vuelve un no-op en
 * dev y CI, donde `synchronize` ya creó la columna con el mismo tipo y default.
 *
 * El default `'user'` cubre las filas existentes: las cuentas y las ApiKeys
 * emitidas antes de esta feature quedan con rol `user` (FR-013).
 */
export class AddRoleToUsersAndApiKeys1790985600000 implements MigrationInterface {
  name = 'AddRoleToUsersAndApiKeys1790985600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar(16) NOT NULL DEFAULT 'user'`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "role" varchar(16) NOT NULL DEFAULT 'user'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
  }
}

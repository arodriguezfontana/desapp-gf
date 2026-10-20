import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega `username` a `users` (020-order-matching-engine, spec FR-001,
 * data-model.md). Requerido, SIN indice unico (la spec es explicita: "no
 * único" salvo el valor reservado "superuser", garantizado por aplicacion
 * en `AuthService.register`, no por constraint de esquema — research.md D2).
 *
 * Backfill para filas existentes: no hay una regla de negocio especifica
 * para el valor de usuarios ya registrados antes de esta feature, asi que
 * se usa un placeholder derivado del email (la parte antes de la @), igual
 * de unico/no-unico que cualquier otro username (data-model.md, Migraciones).
 */
export class AddUsernameToUsers1792040000001 implements MigrationInterface {
  name = 'AddUsernameToUsers1792040000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS: en desarrollo `synchronize: true` ya puede haber creado
    // esta columna a partir de la entidad antes de que corra esta migración.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "username" varchar(255);
    `);

    await queryRunner.query(`
      UPDATE "users"
        SET "username" = split_part("email", '@', 1)
        WHERE "username" IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "username" SET NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "username";`);
  }
}

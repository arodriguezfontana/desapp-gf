import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea `sync_last_success` (spec 031, data-model.md): el momento de la última sincronización exitosa por
 * fuente (`whoscored`, `football_data`), para que la métrica `sync_last_success_timestamp_seconds` sobreviva
 * al reinicio del backend. Una fila por fuente, sin claves foráneas.
 */
export class CreateSyncLastSuccess1793200000000 implements MigrationInterface {
  name = 'CreateSyncLastSuccess1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sync_last_success" (
        "source" varchar(32) PRIMARY KEY,
        "succeeded_at" timestamptz NOT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "sync_last_success";');
  }
}

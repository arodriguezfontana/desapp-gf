import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega 7 columnas de estadísticas de temporada a la tabla `players` (spec 011).
 *
 * Corre en deploy/producción donde `synchronize` está apagado. `IF NOT EXISTS` la
 * vuelve un no-op en dev y CI, donde `synchronize` ya crea las columnas.
 */
export class AddExtendedMetricsToPlayers1791331200000 implements MigrationInterface {
  name = 'AddExtendedMetricsToPlayers1791331200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "goals" integer NULL`);
    await queryRunner.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "assists" integer NULL`);
    await queryRunner.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "keyPasses" integer NULL`);
    await queryRunner.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "dribbles" integer NULL`);
    await queryRunner.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "totalTackles" integer NULL`);
    await queryRunner.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "yellowCards" integer NULL`);
    await queryRunner.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "redCards" integer NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "redCards"`);
    await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "yellowCards"`);
    await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "totalTackles"`);
    await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "dribbles"`);
    await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "keyPasses"`);
    await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "assists"`);
    await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "goals"`);
  }
}


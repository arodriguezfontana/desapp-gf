import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchesPlayedToPlayers1791417600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "matchesPlayed" integer NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "players" DROP COLUMN IF EXISTS "matchesPlayed"`);
  }
}

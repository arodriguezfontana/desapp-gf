import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla `teams` para la feature 010-team-name-crosswalk (US3).
 * Resultado materializado del crosswalk WhoScored ↔ Football-Data.
 * Poblada por `seed:crosswalk`, consumida por PlayerEnrichmentService.
 */
export class CreateTeamsTable1791244800000 implements MigrationInterface {
  name = 'CreateTeamsTable1791244800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teams" (
        "id"                        uuid          NOT NULL DEFAULT gen_random_uuid(),
        "whoscored_name"            varchar(200)  NOT NULL,
        "football_data_team_id"     integer       NOT NULL,
        "football_data_team_name"   varchar(100)  NOT NULL,
        "league_code"               varchar(10)   NOT NULL,
        "crest_url"                 varchar(500)  NULL,
        "created_at"                timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "pk_teams" PRIMARY KEY ("id"),
        CONSTRAINT "uq_teams_whoscored_name" UNIQUE ("whoscored_name")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "teams"`);
  }
}

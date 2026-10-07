import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla `team_name_exception` para la feature 010-team-name-crosswalk.
 * Arranca vacía: las entradas se agregan solo cuando se detecta un mismatch real
 * entre nombres de equipo de WhoScored y Football-Data.
 */
export class CreateTeamNameExceptionTable1791158400000
  implements MigrationInterface
{
  name = 'CreateTeamNameExceptionTable1791158400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_name_exception" (
        "id"                        uuid          NOT NULL DEFAULT gen_random_uuid(),
        "whoscored_raw_name"        varchar(200)  NOT NULL,
        "football_data_team_id"     integer       NOT NULL,
        "football_data_team_name"   varchar(100)  NOT NULL,
        "league_code"               varchar(10)   NOT NULL,
        "created_at"                timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "pk_team_name_exception" PRIMARY KEY ("id"),
        CONSTRAINT "uq_team_name_exception_raw_name" UNIQUE ("whoscored_raw_name")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "team_name_exception"`,
    );
  }
}

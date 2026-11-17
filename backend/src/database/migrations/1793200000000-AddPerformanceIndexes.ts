import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 031-redis-cache-fallback: agrega índices compuestos medidos según patrones de acceso reales
 * para optimizar las consultas de catálogo (filtrado sobre jugadores activos) y la obtención
 * de la cotización más reciente por jugador para un usuario en el ranking (Principio XIII).
 */
export class AddPerformanceIndexes1793200000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_players_removed_league_position"
        ON "players" ("removedAt", "league", "position");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_player_quotes_user_player_calc_desc"
        ON "player_quotes" ("user_id", "player_id", "calculated_at" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_player_quotes_user_player_calc_desc";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_players_removed_league_position";`);
  }
}

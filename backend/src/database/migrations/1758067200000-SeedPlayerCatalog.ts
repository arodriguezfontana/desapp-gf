import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Carga los 20 jugadores ficticios del catálogo de prueba (feature
 * 004-player-catalog): uno por cada combinación de las 5 ligas × 4 posiciones,
 * agrupados en un club ficticio por liga (data-model.md § Seed).
 *
 * Sólo inserta datos: el esquema de `players` lo crea `synchronize` (igual que
 * `users`/`api_keys`), no esta migration (research.md §2). `ON CONFLICT (id) DO
 * NOTHING` la hace idempotente ante corridas repetidas.
 */
export class SeedPlayerCatalog1758067200000 implements MigrationInterface {
  name = 'SeedPlayerCatalog1758067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "players" ("id", "name", "league", "team", "position") VALUES
        ('27cba263-43c5-4294-a0d2-69c2b4b03c2b', 'Milo Ashworth', 'Premier League', 'Northbridge FC', 'GK'),
        ('e87510fd-cce9-4b09-8503-42d685005e3b', 'Callum Whitfield', 'Premier League', 'Northbridge FC', 'DF'),
        ('b95ea36b-10c9-4886-90d4-a6ce2cf5b88d', 'Reece Dalton', 'Premier League', 'Northbridge FC', 'MF'),
        ('6e312925-549c-4bac-95d8-d5e8e01bf9db', 'Tobias Kane', 'Premier League', 'Northbridge FC', 'FW'),
        ('2a0c802f-cf70-4d33-9ec7-0dd5f8fca661', 'Jonas Reinhardt', 'Bundesliga', 'SV Falkenstein', 'GK'),
        ('ec51c1d3-b3d8-4066-a16e-18ec0fd1be08', 'Lukas Brandt', 'Bundesliga', 'SV Falkenstein', 'DF'),
        ('0b9426fe-0f1b-4ae6-89cc-4e411c1331b0', 'Finn Achterberg', 'Bundesliga', 'SV Falkenstein', 'MF'),
        ('f0d89d61-b336-4bd3-a0fc-bf042ed34141', 'Matteo Vollmer', 'Bundesliga', 'SV Falkenstein', 'FW'),
        ('d2166dc5-a450-43fb-afd9-88beadf437a8', 'Iker Salazar', 'La Liga', 'CD Montebravo', 'GK'),
        ('0a141784-aa3c-46cb-9270-caae33de514f', 'Adrián Fuentes', 'La Liga', 'CD Montebravo', 'DF'),
        ('f7bb8d08-e928-447e-8057-40cfebedadfb', 'Nico Barreiro', 'La Liga', 'CD Montebravo', 'MF'),
        ('b0350cb0-1246-4b39-b0f0-7e2faa503f89', 'Diego Marchena', 'La Liga', 'CD Montebravo', 'FW'),
        ('0137761f-229a-45bc-be92-0b73a18529bf', 'Luca Ferraresi', 'Serie A', 'AC Ponteverde', 'GK'),
        ('32458233-e436-4b79-870d-d0c626f56ba5', 'Marco Sabbatini', 'Serie A', 'AC Ponteverde', 'DF'),
        ('82553e3b-6647-48f1-8a9a-7c20824db88e', 'Simone Aldrovandi', 'Serie A', 'AC Ponteverde', 'MF'),
        ('136825a5-b613-42a7-baff-5c87e5f0d258', 'Enzo Ricciarelli', 'Serie A', 'AC Ponteverde', 'FW'),
        ('32fddd2b-8f5a-4d0f-abe2-327f0701edcb', 'Hugo Lambert', 'Ligue 1', 'FC Beaumarais', 'GK'),
        ('bb1cf10a-ccf4-437a-b62b-ee5d5053da0d', 'Théo Marchand', 'Ligue 1', 'FC Beaumarais', 'DF'),
        ('8e71257e-b1ed-4887-9463-9ad0c4aab2da', 'Nathan Girard', 'Ligue 1', 'FC Beaumarais', 'MF'),
        ('269edeec-d849-41e4-99bc-f213da6c58fe', 'Bastien Rocher', 'Ligue 1', 'FC Beaumarais', 'FW')
      ON CONFLICT ("id") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "players" WHERE "id" IN (
        '27cba263-43c5-4294-a0d2-69c2b4b03c2b', 'e87510fd-cce9-4b09-8503-42d685005e3b',
        'b95ea36b-10c9-4886-90d4-a6ce2cf5b88d', '6e312925-549c-4bac-95d8-d5e8e01bf9db',
        '2a0c802f-cf70-4d33-9ec7-0dd5f8fca661', 'ec51c1d3-b3d8-4066-a16e-18ec0fd1be08',
        '0b9426fe-0f1b-4ae6-89cc-4e411c1331b0', 'f0d89d61-b336-4bd3-a0fc-bf042ed34141',
        'd2166dc5-a450-43fb-afd9-88beadf437a8', '0a141784-aa3c-46cb-9270-caae33de514f',
        'f7bb8d08-e928-447e-8057-40cfebedadfb', 'b0350cb0-1246-4b39-b0f0-7e2faa503f89',
        '0137761f-229a-45bc-be92-0b73a18529bf', '32458233-e436-4b79-870d-d0c626f56ba5',
        '82553e3b-6647-48f1-8a9a-7c20824db88e', '136825a5-b613-42a7-baff-5c87e5f0d258',
        '32fddd2b-8f5a-4d0f-abe2-327f0701edcb', 'bb1cf10a-ccf4-437a-b62b-ee5d5053da0d',
        '8e71257e-b1ed-4887-9463-9ad0c4aab2da', '269edeec-d849-41e4-99bc-f213da6c58fe'
      );
    `);
  }
}

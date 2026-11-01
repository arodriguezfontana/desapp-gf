# Phase 1 — Data Model: Team Name Crosswalk

## Entidades nuevas

### `TeamNameException` (dominio)

`src/domain/competition/team-name-exception.ts`

Excepción manual que mapea un nombre de equipo exacto de WhoScored al `Standing` correspondiente en Football-Data cuando la normalización no alcanza.

```ts
export interface TeamNameExceptionProps {
  whoScoredRawName: string;     // exactamente como WhoScored lo devuelve — clave de lookup
  footballDataTeamId: number;   // externalTeamId del Standing en Football-Data
  footballDataTeamName: string; // teamName del Standing en Football-Data
  leagueCode: string;           // uno de: 'PL' | 'BL1' | 'PD' | 'SA' | 'FL1'
}

export class TeamNameException {
  private constructor(
    private readonly _id: string | null,
    private readonly _whoScoredRawName: string,
    private readonly _footballDataTeamId: number,
    private readonly _footballDataTeamName: string,
    private readonly _leagueCode: string,
  ) {}

  static create(props: TeamNameExceptionProps): TeamNameException
  static restore(id: string, props: TeamNameExceptionProps): TeamNameException

  get id(): string | null
  get whoScoredRawName(): string
  get footballDataTeamId(): number
  get footballDataTeamName(): string
  get leagueCode(): string
}
```

**Invariantes**: `whoScoredRawName` es non-empty. Es de solo lectura desde el dominio — el repositorio solo expone `findAll()`. La escritura es exclusivamente manual (INSERT directo en DB o futuro endpoint de admin).

---

### `TeamNameExceptionEntity` (persistencia)

`src/repositories/competition/entities/team-name-exception.entity.ts`

Tabla: `team_name_exception`

| Columna | Tipo SQL | Constraint | Descripción |
|---------|----------|------------|-------------|
| `id` | `uuid` | PK, generado | Identificador interno |
| `whoscored_raw_name` | `varchar(200)` | `UNIQUE NOT NULL` | Nombre exacto de WhoScored (clave de lookup) |
| `football_data_team_id` | `integer` | `NOT NULL` | `externalTeamId` del Standing |
| `football_data_team_name` | `varchar(100)` | `NOT NULL` | `teamName` del Standing |
| `league_code` | `varchar(10)` | `NOT NULL` | Código de liga (`PL`, `BL1`, etc.) |
| `created_at` | `timestamptz` | auto | Timestamp de creación |

Index único en `whoscored_raw_name` (clave de lookup en `resolveTeam`).

---

### `TeamNameExceptionMapper`

`src/repositories/competition/mappers/team-name-exception.mapper.ts`

```ts
@Injectable()
export class TeamNameExceptionMapper {
  toDomain(entity: TeamNameExceptionEntity): TeamNameException
  toEntity(domain: TeamNameException): Partial<TeamNameExceptionEntity>
}
```

---

### `TeamNameExceptionRepository` (interfaz de dominio)

`src/repositories/competition/team-name-exception.repository.ts`

```ts
export interface TeamNameExceptionRepository {
  findAll(): Promise<TeamNameException[]>;
}
```

Solo `findAll()` — el crosswalk carga todas las excepciones de una sola vez (< 15 filas esperadas) y las pasa a `resolveTeam`. Sin paginación.

---

## Funciones puras nuevas

### `normalizeTeamName`

`src/domain/competition/normalize-team-name.ts`

```ts
/**
 * Normaliza un nombre de equipo para comparación fuzzy-free:
 * minúsculas → elimina acentos/diéresis (NFD) → elimina prefijos/sufijos
 * estándar (FC, AFC, CF, SC, SL, AS, SS, FK) → colapsa espacios.
 * Pura, sin I/O, sin imports de NestJS ni TypeORM.
 */
export function normalizeTeamName(name: string): string
```

Ejemplos:
| Input | Output |
|-------|--------|
| `"FC Bayern München"` | `"bayern munchen"` |
| `"Manchester City FC"` | `"manchester city"` |
| `"Paris Saint-Germain FC"` | `"paris saint-germain"` |
| `"AFC Bournemouth"` | `"bournemouth"` |
| `"SS Lazio"` | `"lazio"` |

---

### `resolveTeam`

`src/domain/competition/resolve-team.ts`

```ts
/**
 * Dado un nombre de equipo de WhoScored, busca el Standing correspondiente
 * en Football-Data en dos pasos:
 *   1. Normalización: compara normalizeTeamName(whoScoredName) contra
 *      normalizeTeamName(standing.teamName) para cada standing.
 *   2. Excepción manual: si no hay match, busca en exceptions por
 *      whoScoredRawName exacto (case-sensitive).
 *
 * Devuelve null si ningún paso resuelve.
 * Pura, sin I/O, sin imports de NestJS ni TypeORM.
 */
export function resolveTeam(
  whoScoredTeamName: string,
  standings: Standing[],
  exceptions: TeamNameException[],
): Standing | null
```

**Contrato**:
- Si `whoScoredTeamName` está vacío → `null` sin excepción.
- Si `standings` está vacío → `null` sin excepción.
- Paso 1 tiene prioridad sobre Paso 2.
- Si hay empate en Paso 1 (imposible en la práctica, pero defensivo) → devuelve el primer match.

---

## Migration

`src/database/migrations/1791158400000-CreateTeamNameExceptionTable.ts`

```ts
export class CreateTeamNameExceptionTable1791158400000 implements MigrationInterface {
  name = 'CreateTeamNameExceptionTable1791158400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_name_exception" (
        "id"                      uuid          NOT NULL DEFAULT gen_random_uuid(),
        "whoscored_raw_name"      varchar(200)  NOT NULL,
        "football_data_team_id"   integer       NOT NULL,
        "football_data_team_name" varchar(100)  NOT NULL,
        "league_code"             varchar(10)   NOT NULL,
        "created_at"              timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "pk_team_name_exception" PRIMARY KEY ("id"),
        CONSTRAINT "uq_team_name_exception_raw_name" UNIQUE ("whoscored_raw_name")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "team_name_exception"`);
  }
}
```

La tabla arranca vacía. Sin datos semilla.

---

## Módulo NestJS

`src/modules/competition/team-crosswalk.module.ts`

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([TeamNameExceptionEntity]),
    FootballDataSyncModule,   // importa para reusar STANDING_REPOSITORY si lo necesita algún consumer
  ],
  providers: [
    TeamNameExceptionMapper,
    {
      provide: TEAM_NAME_EXCEPTION_REPOSITORY,
      useClass: TypeOrmTeamNameExceptionRepository,
    },
  ],
  exports: [TEAM_NAME_EXCEPTION_REPOSITORY],
})
export class TeamCrosswalkModule {}
```

Token DI en `src/modules/competition/team-crosswalk.constants.ts`:
```ts
export const TEAM_NAME_EXCEPTION_REPOSITORY = 'TEAM_NAME_EXCEPTION_REPOSITORY';
```

---

## Servicio de sincronización

`backend/src/services/competition/team-crosswalk-sync.service.ts` (`TeamCrosswalkSyncService`), registrado en `TeamCrosswalkSyncModule`.

Flujo (corre dentro de la app, sin llamar a ninguna API externa):
1. `@Cron('0 6 * * 0')` (domingos a las 06:00, después de los crons de WhoScored y Football-Data de las 00:00). Si ya hay una corrida en curso, se salta; un error inesperado se registra y no se propaga al scheduler.
2. Lee en paralelo los `Player.team` distintos de jugadores activos (`PlayerRepository.findActiveTeamNames()`), todas las standings persistidas (`StandingRepository.findAll()`) y las excepciones (`TeamNameExceptionRepository.findAll()`).
3. Para cada equipo llama `resolveTeam(team, standings, exceptions)`.
4. Los resueltos se convierten en `Team` y se guardan con `TeamRepository.upsertTeams()` (clave: `whoscored_name`).
5. Registra en el log el resumen (resueltos / sin resolver) y, si hay sin resolver, un `warn` con sus nombres para cargar la excepción manual correspondiente.

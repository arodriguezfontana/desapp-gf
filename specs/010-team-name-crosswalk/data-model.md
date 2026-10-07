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

## Script standalone

`backend/scripts/seed-crosswalk.ts`

Flujo (no levanta NestJS):
1. Crea `DataSource` con `DATABASE_URL` del env y registra `PlayerEntity`, `StandingEntity`, `TeamNameExceptionEntity`.
2. Llama `GET /competitions/{code}/standings` de Football-Data (con `axios` + `FOOTBALL_DATA_API_TOKEN`) para las 5 ligas → obtiene lista de `Standing`-like objects (`{ externalTeamId, teamName }`).
3. Consulta `SELECT DISTINCT team FROM players WHERE removed_at IS NULL` vía TypeORM.
4. Carga `TeamNameException[]` de la tabla `team_name_exception`.
5. Para cada `team` distinto, llama `resolveTeam(team, standings, exceptions)`.
6. Imprime resumen: total evaluados, resueltos por normalización, resueltos por excepción, sin resolver.
7. Si hay sin resolver → escribe `team_crosswalk_unresolved.txt` en la raíz de `backend/`.
8. Sale con `process.exit(0)` o `process.exit(1)` si hubo error de conexión/API.

Invocación: `npm run seed:crosswalk` desde `backend/`.

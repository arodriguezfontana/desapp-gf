# Phase 1 — Data Model: Catálogo de Jugadores con Datos Reales (WhoScored)

Extiende el modelo de `004-player-catalog` (`Player`, `League`, `Position`,
tabla `players`). No se toca el enum `Position` ni `League` en sí, ni el
contrato de `PlayerFilters`/`PlayerPagination`/`PlayerPage` ya existentes.

## Entidad de dominio: `Player` (extendida)

`domain/player/player.ts` agrega cuatro campos nuevos, todos nullable — las
cuatro métricas de rendimiento pedidas por la spec (FR-006, FR-007):

| Campo | Tipo (dominio) | Regla | FR |
|-------|----------------|-------|----|
| `passesCompleted` | `number \| null` | Promedio por partido, temporada en curso; `null` si no hay valor disponible. | FR-006, FR-007 |
| `shots` | `number \| null` | Ídem. | FR-006, FR-007 |
| `interceptions` | `number \| null` | Ídem. | FR-006, FR-007 |
| `rating` | `number \| null` | Ídem. | FR-006, FR-007 |

`Player.restore(...)` recibe estos cuatro valores además de los cinco campos
existentes (`id`, `name`, `league`, `team`, `position`). Sigue sin existir un
factory de alta (`Player.create()`): el catálogo sigue siendo de sólo lectura
vía API (FR-017); la única vía de escritura es `PlayerSyncService` a través
del repositorio, nunca construyendo un `Player` de dominio para insertar (ver
"Repositorio", abajo — la escritura opera sobre `PlayerEntity` directamente).

`externalId` (id de WhoScored) y `removedAt` (baja lógica) **no** se agregan a
`Player`: son detalles de persistencia/sincronización que el dominio de
lectura no necesita conocer (research.md §2 y §3) — viven sólo en
`PlayerEntity` y en el puerto del repositorio.

## Nuevo tipo de dominio: `PlayerSyncInput`

`domain/player/player-sync-input.ts` — la forma que `PlayerSyncService` le
entrega al repositorio para upsertear un jugador dentro de un equipo. Vive en
`domain/player/` junto a `PlayerFilters`/`PlayerPage` porque usa el enum
`Position` de dominio (posición ya mapeada, nunca el código crudo de
WhoScored):

```ts
export interface PlayerMetrics {
  passesCompleted: number;
  shots: number;
  interceptions: number;
  rating: number;
}

export interface PlayerSyncInput {
  externalId: string;   // id de WhoScored, clave de upsert
  name: string;
  position: Position;   // ya mapeada (FR-011) — nunca el código crudo
  metrics: PlayerMetrics | null; // null si no hay valor disponible (FR-007, FR-018)
}
```

## Nuevo tipo de dominio: función pura `mapWhoScoredPosition`

`domain/player/whoscored-position-mapping.ts` (research.md §5):

```ts
/** @returns la posición del enum propio, o `undefined` si el código no matchea ninguna categoría (FR-012) */
export function mapWhoScoredPosition(rawCode: string): Position | undefined;
```

Tabla de mapeo (spec, Design Decisions — literal, sin lógica difusa):

| Categoría WhoScored | Códigos | Mapea a |
|---|---|---|
| Arquero | `GK` | `Position.GK` |
| Defensor / lateral | `DR`, `DC`, `DL` | `Position.DF` |
| Mediocampo | `DMC`, `DM`, `MC`, `ML`, `MR`, `AMC`, `AML`, `AMR` | `Position.MF` |
| Delantero / extremo | `FWR`, `FW`, `FWL` | `Position.FW` |
| Cualquier otro código | — | `undefined` (jugador excluido, FR-012/FR-013) |

## Nuevo tipo de dominio: función pura `computePlayersToRemove`

`domain/player/team-roster-sync.ts` (Principio VI — la lógica que define qué
cambios forman la unidad atómica vive en el dominio, no en el Service ni el
Repository):

```ts
/**
 * Diferencia de conjuntos: ids externos que estaban activos para un equipo y
 * ya no vienen en el plantel recién scrapeado con éxito → deben darse de baja
 * lógica (FR-016). Pura, sin I/O.
 */
export function computePlayersToRemove(
  previouslyActiveExternalIds: string[],
  incomingExternalIds: string[],
): string[];
```

`PlayerSyncService` (no el repositorio) decide, con esta función, quién se da
de baja; el repositorio sólo ejecuta la escritura atómica que recibe ya
resuelta (upserts + lista de bajas), sin recalcular nada.

## Entidad de persistencia: `PlayerEntity` (extendida)

`repositories/entities/player.entity.ts` agrega:

| Columna nueva | Tipo SQL | Constraints | Uso |
|---|---|---|---|
| `external_id` | `varchar(64)` | `UNIQUE`, `NOT NULL` (tras la migration de limpieza, ver abajo) | Id de jugador de WhoScored; clave de upsert (research.md §2). |
| `removed_at` | `timestamptz` | `NULL` por defecto | Baja lógica — mismo patrón que `ApiKeyEntity.revokedAt`. `NULL` = vigente. |
| `passes_completed` | `double precision` | `NULL` | Métrica, promedio por partido. |
| `shots` | `double precision` | `NULL` | Ídem. |
| `interceptions` | `double precision` | `NULL` | Ídem. |
| `rating` | `double precision` | `NULL` | Ídem. |

`id`, `name`, `league`, `team`, `position` no cambian de tipo ni de
constraints. `id` sigue siendo `uuid` no autogenerado por Postgres: para un
jugador nuevo, `PlayerSyncService` genera el id interno con `randomUUID()` de
`node:crypto` antes del insert (mismo patrón ya usado por `ApiKeyService` —
ver `services/api-key.service.ts`, no requiere un Adapter nuevo: es un
built-in de Node, no una librería externa).

### Esquema: sin migration propia (la maneja `synchronize`)

Igual que el resto de `players` desde `004` (research.md §2 de
`004-player-catalog`), el esquema no lo crea ni lo altera una migration: lo
maneja `synchronize` (activo fuera de producción, `database.module.ts`, sin
tocar) a partir de la propia `PlayerEntity`. Las seis columnas nuevas
(`externalId`, `removedAt`, las 4 métricas) aparecen solas al bootear con la
entidad ya actualizada — igual que pasó con el resto de columnas de `players`
en `004`. Una migration `ALTER TABLE` separada colisionaría con `synchronize`
en el mismo boot (intentaría agregar columnas que `synchronize` ya agregó, o
pisarse con la constraint `UNIQUE` que la propia entidad ya declara).

`external_id` queda `nullable: true` **a nivel de columna** a propósito,
incluso en el estado final: forzar `NOT NULL` en la entidad rompería
`synchronize` mientras exista alguna fila sin valor (las 20 de prueba de
`004`, hasta que la migration de datos de abajo las borra). Que todo jugador
*real* tenga `externalId` es un invariante que garantiza `PlayerSyncInput`
(dominio: el campo no es opcional ahí), no una constraint de Postgres — mismo
criterio que ya evita un enum nativo para `league`/`position` en `004`
(research.md §6). La unicidad sí es una constraint real de Postgres
(`unique: true` en la columna): Postgres permite múltiples `NULL` bajo un
`UNIQUE`, así que no hay conflicto con las filas de prueba mientras existan.

### Migration (una, de datos — en `database/migrations/`, corrida por la
infra ya existente `run-player-catalog-migrations.ts` /
`player-catalog-data-source.ts`, sin cambios a esa infra)

**`RemoveTestPlayerCatalogSeed`**: `DELETE` de las 20 filas fijas insertadas
por `SeedPlayerCatalog1758067200000` (spec, Design Decisions: "reemplaza los
datos de prueba... por datos reales" — los datos ficticios de `004` no son
planteles reales de WhoScored y nunca los va a tocar un upsert por
`external_id`, así que quedarían para siempre si no se borran
explícitamente). `down()` reinserta las 20 filas originales (mismo `INSERT`
que `SeedPlayerCatalog.up()`), por simetría/reversibilidad. Sólo toca datos,
igual que `SeedPlayerCatalog` — nunca el esquema.

No se modifica `SeedPlayerCatalog1758067200000` (una migration ya aplicada no
se edita retroactivamente — buena práctica ya seguida por el proyecto).

## Puerto de repositorio: `PlayerRepository` (extendido)

`repositories/player.repository.ts` agrega dos métodos nuevos, de escritura,
usados sólo por `PlayerSyncService` (nunca por `PlayerService` de lectura):

```ts
export interface PlayerRepository {
  // Ya existentes — sin cambio de firma, sólo de comportamiento interno:
  findPage(filters: PlayerFilters, pagination: PlayerPagination): Promise<PlayerPage>; // + WHERE removed_at IS NULL
  findById(id: string): Promise<Player | null>;                                        // + WHERE removed_at IS NULL

  // Nuevos, sólo para sincronización:
  /** Ids externos (WhoScored) de los jugadores hoy vigentes (removed_at IS NULL) para ese equipo. */
  findActiveExternalIdsByTeam(league: League, team: string): Promise<string[]>;

  /**
   * Aplica, en una única transacción de base de datos, el resultado de
   * sincronizar un equipo puntual (research.md §1: "todo-o-nada" acotado a
   * esta unidad): upsert por `externalId` de `upserts` (reactivando
   * `removed_at = NULL` si el jugador había sido dado de baja antes) y baja
   * lógica (`removed_at = now()`) de los ids en `removeExternalIds`. No
   * recalcula el diff: lo recibe ya resuelto (`computePlayersToRemove`).
   */
  applyTeamRosterSync(
    league: League,
    team: string,
    upserts: PlayerSyncInput[],
    removeExternalIds: string[],
  ): Promise<void>;
}
```

`TypeOrmPlayerRepository.applyTeamRosterSync` usa
`dataSource.transaction(...)` (mismo patrón ya usado por
`TypeOrmApiKeyRepository.saveWithRevocation`): por cada `upsert`, un
`INSERT ... ON CONFLICT (external_id) DO UPDATE SET ...` (nombre, posición,
equipo, liga, métricas, `removed_at = NULL`); para `removeExternalIds`, un
`UPDATE players SET removed_at = now() WHERE external_id = ANY(:ids)`.

## Puerto: `WhoScoredAdapter`

Ver research.md §3 para la interfaz completa (`fetchLeagueTeams`,
`fetchTeamRoster`, y los tipos `WhoScoredLeagueTeams`/`WhoScoredTeamRef`/
`WhoScoredRawPlayer`/`WhoScoredRawMetrics`). Vive en
`adapters/whoscored-adapter.ts`, implementado por
`adapters/http-whoscored-adapter.ts` (axios + cheerio, research.md §4).

**Corrección post-implementación**: `fetchLeagueTeams` devuelve
`{ tournamentId, teams, seedPlayerByTeam }` (no sólo `teams`), y
`fetchTeamRoster` recibe `tournamentId`/`seedPlayerId` como parámetros
explícitos. El Adapter no guarda ninguno de los dos entre llamadas — research.md
§3 y §6 explican por qué (era un estado compartido inseguro entre corridas
solapadas de un Adapter que es singleton).

## Nuevo Service: `PlayerSyncService` (no expuesto a clientes)

No es una entidad de datos, pero define el flujo que conecta todo lo de
arriba — `services/player-sync.service.ts`:

```
sync():
  for each league in Object.values(League):            // FR-004
    try leagueTeams = whoScored.fetchLeagueTeams(league)   // { tournamentId, teams, seedPlayerByTeam }
    catch -> log(nivel=liga, league) ; continue          // FR-014/015 nivel liga

    for each team in leagueTeams.teams:
      syncTeam(league, team, leagueTeams.tournamentId, leagueTeams.seedPlayerByTeam)

syncTeam(league, team, tournamentId, seedPlayerByTeam):
  seedPlayerId = seedPlayerByTeam.get(team.externalTeamId)
  if seedPlayerId is undefined:
    log(nivel=equipo, "sin jugador semilla", league, team) ; return  // FR-014/015 nivel equipo

  try roster = whoScored.fetchTeamRoster(team, tournamentId, seedPlayerId)
  catch -> log(nivel=equipo, league, team) ; return          // FR-014/015 nivel equipo

  upserts: PlayerSyncInput[] = []
  for each raw in roster:
    position = mapWhoScoredPosition(raw.rawPosition)
    if position is undefined:
      manualReviewLog({ reason: 'unrecognized-position', ... }); continue  // FR-012/013
    if raw.metricsFetchFailed:
      manualReviewLog({ reason: 'stats-fetch-failed', ... })               // FR-018
    upserts.push({ externalId: raw.externalId, name: raw.name, position, metrics: raw.metrics })

  activeIds = playerRepository.findActiveExternalIdsByTeam(league, team.team)
  toRemove = computePlayersToRemove(activeIds, upserts.map(u => u.externalId))
  playerRepository.applyTeamRosterSync(league, team.team, upserts, toRemove)  // FR-016, atómico por equipo
```

`tournamentId` y `seedPlayerByTeam` viven como variables locales de esta
misma invocación de `sync()` (parámetros de `syncTeam`), nunca como estado
guardado en el Adapter — es lo que garantiza que dos corridas, solapadas o
no, no se pisen entre sí (research.md §3, §6).

## Trazabilidad FR → modelo

| FR | Dónde se cumple |
|----|-----------------|
| FR-001, FR-002 | Sin cambios: `PlayerController`/`PlayerService`/`ApiKeyGuard` intactos. |
| FR-003 | `HttpWhoScoredAdapter.fetchTeamRoster` (páginas de `matchstatistics`). |
| FR-004 | `PlayerSyncService.sync()` itera sólo `Object.values(League)` (5 valores). |
| FR-005 | `fetchTeamRoster` trae el plantel completo, sin `LIMIT`/tope en el Adapter ni en `PlayerSyncService`. |
| FR-006, FR-007 | `Player` (4 campos nuevos nullable) + `PlayerResponseDto` (contracts/player-api.md). |
| FR-008, FR-009 | `PlayerSyncService` sólo se dispara por `@Cron`; `PlayerService`/`PlayerRepository` de lectura no lo importan (verificado por el tsarch nuevo, research.md §4). |
| FR-010 | `findPage`/`findById` siguen sirviendo lo último vigente aunque una corrida falle a cualquier nivel. |
| FR-011, FR-012, FR-013 | `mapWhoScoredPosition` + manual review log en `PlayerSyncService`. |
| FR-014, FR-015 | Estructura de tres niveles de `sync()` (try/catch por liga y por equipo). |
| FR-016 | `computePlayersToRemove` + `applyTeamRosterSync` + `removed_at` filtrado en lectura. |
| FR-017 | `PlayerSyncService`/`PlayerRepository` de escritura nunca se exponen vía Controller. |
| FR-018 | `metricsFetchFailed` en `WhoScoredRawPlayer` + manual review log. |

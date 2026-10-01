---

description: "Task list template for feature implementation"
---

# Tasks: Catálogo de Jugadores con Datos Reales (WhoScored)

**Input**: Design documents from `specs/006-whoscored-catalog-sync/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/player-api.md, contracts/whoscored-adapter.md, quickstart.md (todos existentes)

**Tests**: Incluidos como tareas obligatorias — la constitución (Principio IX, Principio X) exige unit + integración + e2e con casos felices y borde para todo requerimiento, no son opcionales en este proyecto. Ningún test de esta feature pega contra `whoscored.com` real (research.md §8, contracts/whoscored-adapter.md).

**Organización**: Tareas agrupadas por user story (spec.md: US1 y US2 son P1, US3 es P2) para permitir implementación y prueba independientes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: A qué user story pertenece (US1, US2, US3)
- Cada tarea incluye la ruta exacta del archivo

## Path Conventions

Monorepo web existente. Esta feature es backend-only: `backend/src/`, `backend/test/`, más un archivo compartido en `docs/postman/`. Estructura y rutas exactas: [plan.md § Project Structure](./plan.md#project-structure).

---

## Phase 1: Setup

**Purpose**: Dependencias nuevas y wiring compartido mínimo que el resto de la feature reutiliza (research.md §0, §4).

- [X] T001 [P] Agregar `@nestjs/schedule`, `axios` y `cheerio` a `backend/package.json` (dependencies)
- [X] T002 [P] Agregar `exports: [PLAYER_REPOSITORY]` a `backend/src/player.module.ts` para que `PlayerSyncModule` lo reuse sin exponer nada del lado de lectura (research.md §3, plan.md § Structure Decision)
- [X] T003 [P] Crear `backend/src/player-sync.constants.ts` con `WHOSCORED_ADAPTER = Symbol('WHOSCORED_ADAPTER')` y `WHOSCORED_REQUEST_TIMEOUT_MS = 15000` (research.md §6)

**Checkpoint**: dependencias y constantes listas; nada de esto rompe `004`/`005` (son sólo adiciones).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema, dominio de lectura y guardrail de arquitectura que **las 3 user stories** necesitan desde el primer commit. Incluye `mapWhoScoredPosition`: aunque su comportamiento de exclusión+log es el objeto de US3, `PlayerSyncInput.position` es un campo `Position` no-opcional — US2 no puede completar un solo upsert real sin una función de mapeo ya lista, igual que `004-player-catalog` tuvo que construir `ApiKeyGuard` en Foundational pese a ser nominalmente su US3.

**⚠️ CRITICAL**: ninguna user story puede completarse antes de que esta fase esté lista.

### Dominio (`domain/player/`)

- [X] T004 [P] Extender la clase `Player` (constructor privado, `Player.restore(...)`, getters) con cuatro campos nuevos y nullable — `passesCompleted`, `shots`, `interceptions`, `rating` — en `backend/src/domain/player/player.ts` (data-model.md § Entidad de dominio)
- [X] T005 [P] Actualizar `backend/src/domain/player/player.spec.ts`: casos con las 4 métricas con valor y con las 4 en `null` (depende de T004)
- [X] T006 [P] Crear función pura `mapWhoScoredPosition(rawCode: string): Position | undefined` con la tabla de la spec (GK; DR/DC/DL→DF; DMC/DM/MC/ML/MR/AMC/AML/AMR→MF; FWR/FW/FWL→FW; cualquier otro código → `undefined`) en `backend/src/domain/player/whoscored-position-mapping.ts` (data-model.md, research.md §5)
- [X] T007 [P] Unit tests de `mapWhoScoredPosition`: un caso por categoría (GK/DF/MF/FW) + un código no reconocido → `undefined` en `backend/src/domain/player/whoscored-position-mapping.spec.ts` (depende de T006)

### Persistencia (`repositories/`)

- [X] T008 Extender `PlayerEntity` con `externalId` (`varchar(64)`, `nullable: true`, `unique: true` — nullable a nivel de columna a propósito, ver comentario en el archivo), `removedAt` (`timestamptz`, nullable), `passesCompleted`/`shots`/`interceptions`/`rating` (`double precision`, nullable) en `backend/src/repositories/entities/player.entity.ts` (data-model.md § PlayerEntity). **Corrección de implementación**: sin `ALTER TABLE` propio — el esquema de `players` lo maneja `synchronize` a partir de esta misma entidad (mismo criterio que `004`, research.md §2 de `004-player-catalog`); una migration de esquema separada colisionaría con `synchronize` en el boot.
- [X] T009 Actualizar `PlayerMapper.toDomain`/`toEntity` para mapear las 4 métricas nuevas (depende de T004, T008)
- [X] ~~T010~~ Eliminada: no hace falta una migration de esquema (`synchronize` ya cubre las columnas nuevas de T008, ver la corrección de implementación ahí).
- [X] T011 Crear migration de **datos** `1758150000000-RemoveTestPlayerCatalogSeed.ts` en `backend/src/database/migrations/`: `DELETE` de las 20 filas fijas de `SeedPlayerCatalog1758067200000` (spec, Design Decisions: reemplaza los datos de prueba; esas filas nunca van a matchear un upsert por `externalId`, quedarían para siempre si no se borran); `down()` reinserta las 20 filas originales (mismo patrón que `SeedPlayerCatalog`, sólo datos — data-model.md § Migrations, corregido)
- [X] T012 Actualizar `TypeOrmPlayerRepository.findPage`/`findById` agregando `WHERE removed_at IS NULL` (research.md §2: un jugador dado de baja deja de listarse y responde 404 sin borrar la fila) (depende de T008)
- [X] T013 [P] Actualizar `PlayerResponseDto` con los 4 campos nuevos (`@ApiProperty({ nullable: true })`) y su mapeo en `fromDomain` en `backend/src/controllers/dto/player/player-response.dto.ts` (contracts/player-api.md) (depende de T004)

### Guardrail de arquitectura

- [X] T014 [P] Agregar a `backend/test/architecture.spec.ts` la regla "el Service no debe importar `axios`/`cheerio` directo, eso vive detrás de `WhoScoredAdapter`" (mismo patrón que la regla ya existente para `bcrypt`) — research.md §4

**Checkpoint**: esquema migrado, `Player` expone métricas, la lectura filtra bajas lógicas, el contrato JSON ya declara los campos nuevos, y el guardrail de capas está en verde (todavía trivialmente, hasta que exista el Adapter). A partir de acá pueden avanzar las 3 user stories.

---

## Phase 3: User Story 1 — Consultar el catálogo con datos reales de las 5 ligas (Priority: P1) 🎯 MVP

**Goal**: `GET /players`/`GET /players/:id` exponen jugadores reales (con sus 4 métricas) manteniendo exactamente el mismo contrato de filtros/paginación/auth de `004`.

**Independent Test**: con filas ya sembradas como si vinieran de una sincronización exitosa (algunas vigentes, alguna dada de baja), `GET /players` filtra/pagina igual que en `004` y expone las 4 métricas (valor o `null`); `GET /players/:id` da 404 para un jugador dado de baja.

> Nada de la implementación de esta fase es nueva: `Player`, `PlayerMapper`, el filtro `removed_at IS NULL` y `PlayerResponseDto` ya se construyeron en Foundational (T004, T009, T012, T013) porque US1/US2/US3 los necesitaban por igual. El aporte de esta fase es la verificación de punta a punta de que el contrato de lectura efectivamente se sostiene con el nuevo esquema — mismo criterio que `004-player-catalog` aplicó a su US3 con `ApiKeyGuard`.

### Tests for User Story 1

- [X] T015 [P] [US1] Integration test: sembrar filas con `externalId`/métricas/alguna con `removedAt` seteado directamente vía `DataSource`, verificar que `findPage`/`findById` excluyen las dadas de baja y exponen las 4 métricas (valor y `null`) — extender `backend/src/services/player.service.integration.spec.ts`
- [X] T016 [P] [US1] E2E test: sembrar filas reales (mismo mecanismo que T015) sin depender de ninguna migration de seed ni del scraping real; verificar `GET /players` (filtros liga/equipo/posición, paginación, `total`, 200/`[]` sin match, 4 métricas con valor y `null`), `GET /players/:id` (200 con métricas, 404 para un id dado de baja y para uno inexistente), y que los 4 casos de `ApiKeyGuard` siguen dando 401 sin cambios — extender `backend/test/player-catalog.e2e-spec.ts`

**Checkpoint**: el contrato de lectura de `004` queda validado end-to-end contra el nuevo esquema con métricas — MVP demostrable en cuanto Foundational + esta fase estén en verde.

---

## Phase 4: User Story 2 — El catálogo siempre refleja la última sincronización exitosa, nunca una consulta en vivo (Priority: P1)

**Goal**: construir el motor de sincronización (`WhoScoredAdapter` + `PlayerSyncService` + scheduler) con degradación independiente por liga y por equipo (FR-014/015), atómico por equipo (FR-016), y que nunca se dispara desde una request (FR-008/009).

**Independent Test**: con un `WhoScoredAdapter` fake (sin red), una corrida completa deja el catálogo con los jugadores esperados por equipo; una liga o un equipo que falla no afecta a los demás y conserva su última sincronización exitosa; una corrida posterior da de baja a los jugadores que ya no aparecen en un plantel y reactiva a los que vuelven; ninguna llamada a `GET /players`/`GET /players/:id` dispara el Adapter (verificado por T014).

### Tests for User Story 2 ⚠️

> Escribir estos tests primero y confirmar que fallan antes de implementar (no hay todavía `WhoScoredAdapter` ni `PlayerSyncService`).

- [X] T017 [P] [US2] Unit tests de `computePlayersToRemove`: sin cambios, sólo altas, sólo bajas, altas y bajas combinadas — en `backend/src/domain/player/team-roster-sync.spec.ts`
- [X] T018 [P] [US2] Integration test de `findActiveExternalIdsByTeam` + `applyTeamRosterSync` contra Postgres real (Testcontainers): upsert de jugadores nuevos, reactivación de un `externalId` previamente dado de baja, baja lógica de los ausentes, y que todo ocurre en una única transacción — `backend/src/repositories/typeorm-player.repository.integration.spec.ts`
- [X] T019 [P] [US2] Unit tests de `HttpWhoScoredAdapter` con `axios` mockeado (`jest.mock('axios')`) resolviendo el fixture (T027), parseo real vía `cheerio`: plantel con métricas disponibles, timeout/error de red en `fetchLeagueTeams`/`fetchTeamRoster` → excepción, y un jugador puntual con página de stats rota → `metricsFetchFailed: true` — `backend/src/adapters/http-whoscored-adapter.spec.ts`
- [X] T020 [P] [US2] Unit tests de `PlayerSyncService` con `WhoScoredAdapter` fake y `PlayerRepository` mockeado: una liga/equipo exitosos hacen upsert correcto; una liga que falla no afecta a las demás; un equipo que falla no afecta a los demás equipos de su liga ni de otras — `backend/src/services/player-sync.service.spec.ts`
- [X] T021 [P] [US2] Integration test de `PlayerSyncService` con `WhoScoredAdapter` fake (datos fijos, sin HTTP) contra Postgres real: una corrida completa deja el catálogo esperado; una corrida posterior da de baja a los ausentes y reactiva a los que vuelven — `backend/src/services/player-sync.service.integration.spec.ts`

### Implementation for User Story 2

- [X] T022 [P] [US2] Crear función pura `computePlayersToRemove(previouslyActiveExternalIds, incomingExternalIds): string[]` en `backend/src/domain/player/team-roster-sync.ts` (data-model.md, research.md §1)
- [X] T023 [P] [US2] Crear tipos `PlayerMetrics`/`PlayerSyncInput` (`externalId`, `name`, `position: Position`, `metrics: PlayerMetrics | null`) en `backend/src/domain/player/player-sync-input.ts`
- [X] T024 [US2] Extender el puerto `PlayerRepository` con `findActiveExternalIdsByTeam(league, team): Promise<string[]>` y `applyTeamRosterSync(league, team, upserts: PlayerSyncInput[], removeExternalIds: string[]): Promise<void>` en `backend/src/repositories/player.repository.ts` (depende de T023)
- [X] T025 [US2] Implementar ambos métodos en `TypeOrmPlayerRepository`: `findActiveExternalIdsByTeam` (`SELECT external_id WHERE league=... AND team=... AND removed_at IS NULL`); `applyTeamRosterSync` como una única `dataSource.transaction(...)` — `INSERT ... ON CONFLICT (external_id) DO UPDATE SET ..., removed_at = NULL` por cada upsert, `UPDATE players SET removed_at = now() WHERE external_id = ANY(:ids)` para las bajas — en `backend/src/repositories/typeorm-player.repository.ts` (depende de T024; mismo patrón transaccional que `TypeOrmApiKeyRepository.saveWithRevocation`)
- [X] T026 [P] [US2] Crear el puerto `WhoScoredAdapter` (`fetchLeagueTeams`, `fetchTeamRoster`) + tipos crudos `WhoScoredTeamRef`/`WhoScoredRawPlayer`/`WhoScoredRawMetrics` en `backend/src/adapters/whoscored-adapter.ts` (research.md §3, contracts/whoscored-adapter.md)
- [X] T027 [US2] Capturar y versionar al menos un HTML real de una página de `matchstatistics` de WhoScored en `backend/test/fixtures/whoscored/` (research.md §8; precondición corregida en research.md §0 — no existía en el repo)
- [X] T028 [US2] Implementar `HttpWhoScoredAdapter` (axios + cheerio; tabla interna liga→identificadores de WhoScored; timeout `WHOSCORED_REQUEST_TIMEOUT_MS`; distingue `metrics: null` de `metricsFetchFailed: true` por jugador) en `backend/src/adapters/http-whoscored-adapter.ts` (depende de T026)
- [X] T029 [US2] Implementar `PlayerSyncService.sync()`: itera `Object.values(League)`; `try/catch` por liga (`fetchLeagueTeams`) y por equipo (`fetchTeamRoster`) que sólo saltea esa unidad y loguea para diagnóstico (FR-014/015); arma `PlayerSyncInput[]` del plantel (posición ya mapeada — el branch de exclusión de códigos no reconocidos lo agrega T034/US3); por equipo, `findActiveExternalIdsByTeam` + `computePlayersToRemove` + `applyTeamRosterSync` — en `backend/src/services/player-sync.service.ts` (depende de T006, T022, T023, T025, T026)
- [X] T030 [US2] Crear `PlayerSyncModule` (`imports: [PlayerModule, ScheduleModule.forRoot()]`, providers: `PlayerSyncService`, `{ provide: WHOSCORED_ADAPTER, useClass: HttpWhoScoredAdapter }`) en `backend/src/player-sync.module.ts` (depende de T002, T028, T029)
- [X] T031 [US2] Agregar `@Cron(CronExpression.EVERY_WEEK)` a `PlayerSyncService.sync()` (research.md §7) (depende de T029, T001)
- [X] T032 [US2] Importar `PlayerSyncModule` en `backend/src/app.module.ts` (depende de T030)

**Checkpoint**: motor de sincronización completo y resiliente por liga/equipo, nunca disparado por una request (T014 en verde con el Adapter ya existiendo). US1 + US2 juntas dejan el catálogo con datos reales de punta a punta.

---

## Phase 5: User Story 3 — Mapeo de posiciones finas con exclusión auditable de códigos no reconocidos (Priority: P2)

**Goal**: dentro del mismo `PlayerSyncService` construido en US2, excluir y loguear a los jugadores con un código de posición no reconocido (FR-012/013), y a los jugadores con falla técnica puntual en su página de estadísticas (FR-018), sin que ninguno de los dos casos cuente como falla del equipo.

**Independent Test**: con un `WhoScoredAdapter` fake que incluye, en un mismo plantel, un jugador por cada categoría reconocida, uno con un código fuera de la tabla, y uno con `metricsFetchFailed: true` — los reconocidos se importan con su posición correcta, el no reconocido no se persiste y genera una entrada de log distinta a la del jugador con falla de stats (que sí se importa, con métricas `null`), y el resto del equipo se sincroniza con normalidad.

> `mapWhoScoredPosition` ya se implementó y unit-testeó en Foundational (T006, T007) porque US2 no podía completar un solo upsert sin una `Position` válida. El aporte de esta fase es integrar la política de exclusión+log y de falla-de-stats+log dentro de `PlayerSyncService` (mismo archivo que T029 — ediciones secuenciales, no paralelizables entre sí).

### Tests for User Story 3

- [X] T033 [P] [US3] Extender `backend/src/services/player-sync.service.spec.ts` (de T020): un código de cada categoría se mapea e importa correctamente; un código no reconocido no se persiste y genera una entrada de log (`reason: 'unrecognized-position'`) sin afectar al resto del equipo; un jugador con `metricsFetchFailed: true` se importa con las 4 métricas en `null` y genera su propia entrada de log (`reason: 'stats-fetch-failed'`), distinta de la anterior; ninguno de los dos casos hace fallar al equipo

### Implementation for User Story 3

- [X] T034 [US3] Extender `PlayerSyncService.sync()`: por cada jugador crudo del plantel, llamar `mapWhoScoredPosition(raw.rawPosition)`; si devuelve `undefined`, no agregarlo a `upserts` y loguear (`Logger('PlayerSyncManualReview')`, `{ reason: 'unrecognized-position', whoScoredPlayerId, name, team, league, rawPosition }`) sin afectar al resto del equipo (FR-012/013) — `backend/src/services/player-sync.service.ts` (mismo archivo que T029 — secuencial)
- [X] T035 [US3] Extender `PlayerSyncService.sync()`: si `raw.metricsFetchFailed`, igual agregar el jugador a `upserts` con `metrics: null` y loguear (`{ reason: 'stats-fetch-failed', whoScoredPlayerId, name, team, league }`) sin afectar al resto del equipo (FR-018) — `backend/src/services/player-sync.service.ts` (mismo archivo que T034 — secuencial)

**Checkpoint**: las 3 user stories quedan cubiertas; el motor de sincronización es completo, resiliente y auditable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: cerrar la Definición de Terminado (Principio X) más allá de las user stories.

- [X] T036 [P] Actualizar el ejemplo de respuesta de `GET /players`/`GET /players/:id` en `docs/postman/desapp.postman_collection.json` con los 4 campos nuevos
- [X] T037 Correr la validación manual completa de [quickstart.md](./quickstart.md): instalar dependencias nuevas, levantar el backend (migrations corren solas), disparar una sincronización manual, verificar filtros/paginación/métricas y los 3 niveles de degradación, y que Swagger (`/docs`) muestra los 4 campos como `nullable`
- [X] T038 Correr `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e` en `backend/` y confirmar que el test de arquitectura (`tsarch`, incluida la regla nueva de T014) queda en verde

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato.
- **Foundational (Phase 2)**: depende de Setup — **bloquea** a las 3 user stories.
- **User Story 1 (Phase 3)**: depende de Foundational. Es el MVP — su implementación ya está resuelta en Foundational, sólo agrega la verificación end-to-end.
- **User Story 2 (Phase 4)**: depende de Foundational (en particular de `mapWhoScoredPosition`, T006). Es el grueso de la feature: el motor de sincronización completo.
- **User Story 3 (Phase 5)**: depende de Foundational **y** de que `PlayerSyncService` ya exista (US2, T029): edita el mismo archivo agregando dos branches nuevos al mismo método.
- **Polish (Phase 6)**: depende de que las 3 user stories estén completas.

### Notas sobre "independencia" de las user stories

US1/US2/US3 comparten `PlayerSyncService.ts` (US2 lo crea, US3 lo extiende secuencialmente) y el esquema de `players` (Foundational), así que no son paralelizables entre sí por distintos desarrolladores sin pisarse archivos. Cada una sigue siendo **independientemente demostrable y testeable** una vez completa (el criterio real de "independent test" de la spec): US1 se demuestra sembrando filas directamente, sin que exista todavía el Adapter; US2 se demuestra con un `WhoScoredAdapter` fake, sin depender de US3; US3 sólo agrega dos casos de borde sobre el motor que US2 ya deja funcionando. La ejecución recomendada es secuencial en orden de prioridad: Foundational → US1 → US2 → US3 → Polish.

### Parallel Opportunities

- Todas las tareas `[P]` de Setup (T001-T003) en paralelo.
- Dentro de Foundational: T004/T006 en paralelo entre sí (archivos de dominio distintos); T005/T007 en paralelo una vez existen T004/T006 respectivamente; T008/T013/T014 en paralelo entre sí (no dependen unas de otras).
- Dentro de US2: T022/T023/T026 en paralelo entre sí (dominio y puerto del Adapter son independientes); los tests T017-T021 en paralelo entre sí una vez existen sus dependencias de implementación respectivas.
- T015/T016 (US1) en paralelo entre sí.

---

## Parallel Example: Foundational — dominio y persistencia

```bash
Task: "Extender Player con 4 métricas nullable en backend/src/domain/player/player.ts"
Task: "Crear mapWhoScoredPosition en backend/src/domain/player/whoscored-position-mapping.ts"
```

## Parallel Example: User Story 2 — dominio y Adapter

```bash
Task: "Crear computePlayersToRemove en backend/src/domain/player/team-roster-sync.ts"
Task: "Crear PlayerMetrics/PlayerSyncInput en backend/src/domain/player/player-sync-input.ts"
Task: "Crear el puerto WhoScoredAdapter en backend/src/adapters/whoscored-adapter.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational (crítico — incluye `mapWhoScoredPosition`, sin el cual US2 no puede producir un upsert válido).
3. Completar Phase 3: User Story 1.
4. **Parar y validar**: sembrar filas de prueba con el nuevo esquema y correr los escenarios de quickstart.md contra `GET /players`/`GET /players/:id`.
5. Recién ahí seguir con US2 (el motor de sincronización real).

### Entrega incremental

1. Setup + Foundational → esquema y contrato de lectura listos, sin datos reales todavía.
2. + US1 → contrato de lectura validado con datos con forma real (MVP, aunque sembrados a mano).
3. + US2 → motor de sincronización completo contra un Adapter fake; con `HttpWhoScoredAdapter` real, el catálogo se puebla solo, semanalmente.
4. + US3 → exclusión y logging auditable de los casos borde de posición y de stats.
5. + Polish → Postman, quickstart y suite completa en verde (Definición de Terminado).

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes entre sí.
- `[Story]` mapea cada tarea a su user story para trazabilidad contra spec.md.
- No modificar `backend/src/database/database.module.ts` ni `backend/src/database/player-catalog-data-source.ts`/`run-player-catalog-migrations.ts` (la infra de migrations ya existente corre las nuevas sin cambios).
- No modificar `SeedPlayerCatalog1758067200000.ts` (una migration ya aplicada no se edita retroactivamente); su remoción es una migration nueva (T011).
- `axios`/`cheerio` sólo se importan dentro de `backend/src/adapters/` (T014 lo hace cumplir).
- Ningún test hace una request real a `whoscored.com` (T027 + T019 usan el fixture capturado con `axios` mockeado; T020/T021 usan un fake sin HTTP).
- Commitear después de cada tarea o grupo lógico; no mezclar tareas de fases distintas en un mismo commit.

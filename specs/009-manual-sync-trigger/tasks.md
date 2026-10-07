# Tasks: Disparo manual de sincronización (WhoScored y Football-Data)

**Feature**: `009-manual-sync-trigger` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md) | **Date**: 2026-10-06

## Resumen

21 tareas en 5 fases. Las fases 2 y 3 (US1 y US2) pueden avanzar en paralelo tras completar la Fase 1. La Fase 4 (e2e) requiere que las Fases 2 y 3 estén completas.

| Fase | Descripción | Tareas |
|------|-------------|--------|
| 1 | Fundacional | T001–T004 |
| 2 | US1 WhoScored async | T005–T012 |
| 3 | US2 Football-Data sync | T013–T019 |
| 4 | US3+US4 e2e | T020 |
| 5 | Polish | T021 |

**Ya implementado (Fase 0)**:
- `backend/src/domain/sync/errors/sync-in-progress.error.ts` — `SyncInProgressError extends DomainError`
- `backend/src/shared/errors/messages.ts` — `SYNC_IN_PROGRESS_MESSAGE`
- `backend/src/shared/filters/all-exceptions.filter.ts` — rama `instanceof SyncInProgressError → 409 + runId`
- `backend/src/shared/filters/all-exceptions.filter.runid.spec.ts` — 4 tests verdes

---

## Fase 1 — Fundacional (prerequisito de todo)

Tipos de dominio, constante faltante y actualización del helper de tests e2e. Completar antes de comenzar las Fases 2 y 3.

### Meta
Que existan los tipos de dominio y los artefactos compartidos que todos los archivos siguientes van a importar.

- [X] T001 [P] Agregar `SYNC_RUN_NOT_FOUND_MESSAGE` en español en `backend/src/shared/errors/messages.ts` (mismo patrón que `SYNC_IN_PROGRESS_MESSAGE`)
- [X] T002 [P] Crear `backend/src/domain/player/sync-run.ts` con los tipos de dominio de WhoScored sin decoradores: `SyncRunStatus` (literal union), `SyncFailedUnit` (reason: `'league-fetch-failed' | 'no-seed-player' | 'roster-fetch-failed'`), `WhoScoredSyncSummary`, `SyncRunState` (ver [data-model.md](./data-model.md))
- [X] T003 [P] Crear `backend/src/domain/competition/sync-summary.ts` con los tipos de dominio de Football-Data sin decoradores: `LeagueSyncResult`, `FootballDataSyncSummary` (ver [data-model.md](./data-model.md))
- [X] T004 [P] Actualizar `backend/test/test-app.ts` para aceptar un segundo parámetro opcional `overrides?: { token: string | symbol | Type<unknown>; useValue: unknown }[]` que pase cada item a `moduleRef.overrideProvider(token).useValue(useValue)` antes de `compile()`, sin cambiar el comportamiento cuando se omite

---

## Fase 2 — US1: WhoScored asincrónico (P1)

`POST /sync/whoscored` responde 202 + runId; `GET /sync/whoscored/:runId` devuelve estado y resumen.

### Meta de US1
Con una ApiKey válida, `POST /sync/whoscored` responde `202` con `runId` de inmediato; `GET /sync/whoscored/:runId` devuelve el estado (`running`/`completed`/`failed`) y, al terminar, el resumen con conteos.

### Criterio de test independiente
`player-sync.service.manual-run.spec.ts` verde; `POST /sync/whoscored` sin ApiKey → 401; con ApiKey válida → 202; segundo POST con corrida en curso → 409 con `runId` de la corrida en curso.

- [X] T005 Crear `backend/src/services/player-sync/player-sync.service.manual-run.spec.ts` con tests unitarios (mocks de adapter y repositorio) para: `startManualRun()` devuelve runId y estado `running`, segundo `startManualRun()` con lock tomado lanza `SyncInProgressError(runId)`, `getRun()` devuelve el estado actual, corrida completa actualiza el estado a `completed` con resumen, corrida con error fatal pasa a `failed` con mensaje genérico, retención de máximo 20 corridas descarta la terminada más vieja, `sync()` llama a la lógica y no lanza cuando el lock está libre, `sync()` con lock tomado loguea una advertencia y retorna void sin lanzar (ver [research.md](./research.md) R1 y R5)
- [X] T006 Modificar `syncTeam()` en `backend/src/services/player-sync/player-sync.service.ts` para devolver `{ failed?: SyncFailedUnit; playersSynced: number }` en vez de `void`; los tres caminos que hoy hacen `return` pasan a devolver `{ failed: { league, team?, reason }, playersSynced: 0 }` o `{ playersSynced: upserts.length }`; `sync()` existente descarta el retorno y sigue siendo `Promise<void>`
- [X] T007 Agregar a `PlayerSyncService` en `backend/src/services/player-sync/player-sync.service.ts`: constante `private readonly MAX_RETAINED_RUNS = 20`, campo `private activeRunId: string | null = null`, campo `private readonly runs = new Map<string, SyncRunState>()`, método privado `evictOldRuns()` que descarta la entrada terminada más vieja cuando el Map supera `MAX_RETAINED_RUNS` (nunca descartar la que está `running`), método privado `runSyncAndRecord(runId, trigger)` que contiene el bucle de ligas+equipos de `sync()`, actualiza el estado en el Map (running→completed/failed), y libera el lock en un `finally`; actualizar `sync()` para: comprobar `activeRunId`, si está tomado loguear warn y retornar (sin lanzar), si está libre generar un runId para esa corrida del Cron, inicializar la entrada en el Map, fijar `activeRunId` y llamar `runSyncAndRecord` con `trigger: 'cron'`; agregar `startManualRun()` público que comprueba el lock, lanza `SyncInProgressError(activeRunId)` si está tomado, genera runId, inicializa Map, fija lock y llama `runSyncAndRecord` sin await; agregar `getRun(runId: string): SyncRunState | undefined` que devuelve `this.runs.get(runId)`
- [X] T008 [P] Crear `backend/src/controllers/player-sync/dto/sync-accepted.dto.ts` con `SyncAcceptedDto` (campos `runId: string`, `status: 'running'`) y su método estático `fromDomain(state: SyncRunState): SyncAcceptedDto`, con `@ApiProperty` en cada campo
- [X] T009 [P] Crear `backend/src/controllers/player-sync/dto/sync-run-status.dto.ts` con `SyncRunStatusDto` (campos: `runId`, `status`, `trigger`, `startedAt`, `finishedAt?`, `teamsSynced?`, `playersSynced?`, `failedUnits?`, `errorMessage?`) y `fromDomain(state: SyncRunState): SyncRunStatusDto`, con `@ApiProperty` en cada campo y `@ApiPropertyOptional` en los opcionales; `failedUnits` serializa `league` como string del valor del enum `League`
- [X] T010 Crear `backend/src/controllers/player-sync/player-sync.controller.ts` con `PlayerSyncController`: `@Controller('sync')`, `@ApiTags('sync')`, `@Public()`, `@UseGuards(ApiKeyGuard)`, `@ApiSecurity('ApiKeyAuth')`; endpoint `POST /sync/whoscored` → llama `playerSyncService.startManualRun()`, responde `202` con `SyncAcceptedDto`; endpoint `GET /sync/whoscored/:runId` → llama `playerSyncService.getRun(runId)`, si `undefined` lanza `NotFoundException(SYNC_RUN_NOT_FOUND_MESSAGE)`, si existe responde `200` con `SyncRunStatusDto`; `@ApiResponse` por código (202, 200, 401, 404, 409) según [contracts/sync-api.md](./contracts/sync-api.md)
- [X] T011 Actualizar `backend/src/modules/player-sync/player-sync.module.ts`: agregar `ApiKeyModule` a `imports`, agregar `ApiKeyGuard` a `providers`, registrar `PlayerSyncController` en `controllers`
- [X] T012 Crear `backend/src/services/player-sync/player-sync.service.manual-run.integration.spec.ts` con un test de integración contra Postgres efímero (Testcontainers) y un adapter fake de WhoScored (que devuelve datos mínimos válidos sin hacer requests reales): verificar que `startManualRun()` inicia la corrida, el estado pasa a `completed` cuando termina, `getRun(runId)` refleja el resumen final con `teamsSynced ≥ 0`

---

## Fase 3 — US2: Football-Data sincrónico (P1)

`POST /sync/football-data` espera ~70 s (con delay real) o responde de inmediato con fakes, devuelve `FootballDataSyncSummary`.

### Meta de US2
Con una ApiKey válida, `POST /sync/football-data` responde `200` con el resumen de ligas; un segundo POST durante la corrida responde `409` sin `runId`.

### Criterio de test independiente
`football-data-sync.service.manual-run.spec.ts` verde; `POST /sync/football-data` sin ApiKey → 401; con ApiKey válida → 200 con `leagues` y `failedLeagues`; segundo POST con corrida en curso → 409 sin `runId`.

- [X] T013 Crear `backend/src/services/competition/football-data-sync.service.manual-run.spec.ts` con tests unitarios (mocks de adapter y repos) para: `triggerManualRun()` retorna `FootballDataSyncSummary` con `leagues` y `failedLeagues`, `triggerManualRun()` con lock tomado lanza `SyncInProgressError()` (sin runId), una liga con error en standings aparece en `failedLeagues`, `handleCron()` con lock tomado loguea warn y retorna void, `syncAllLeagues()` retorna el resumen (sin lock, para el test de integración existente)
- [X] T014 Modificar `syncStandingsForLeague()` en `backend/src/services/competition/football-data-sync.service.ts` para devolver `{ synced: number; failed: boolean }` en vez de `void`; el path de éxito devuelve `{ synced: standings.length, failed: false }`, el catch devuelve `{ synced: 0, failed: true }`
- [X] T015 Modificar `syncMatchesForLeague()` en `backend/src/services/competition/football-data-sync.service.ts` para devolver `{ synced: number; failed: boolean }` en vez de `void`; mismo patrón que T014
- [X] T016 Modificar `syncAllLeagues()` en `backend/src/services/competition/football-data-sync.service.ts` para devolver `FootballDataSyncSummary` (acumula resultados de T014 y T015 en `LeagueSyncResult[]`, construye `failedLeagues` desde `failedSteps`); agregar `private isRunning = false`; agregar `async triggerManualRun(): Promise<FootballDataSyncSummary>` que comprueba `isRunning`, lanza `SyncInProgressError()` si está tomado, fija `isRunning = true`, llama `syncAllLeagues()` en un `try/finally` que libera el lock; actualizar `handleCron()` para comprobar `isRunning`, si está tomado loguear warn y retornar, si no fijar lock, llamar `syncAllLeagues()` y liberar en `finally`
- [X] T017 Crear `backend/src/controllers/competition/dto/sync-summary.dto.ts` con `SyncSummaryDto` (campos `leagues: LeagueSyncResultDto[]`, `failedLeagues: string[]`) y `LeagueSyncResultDto` (campos `leagueCode`, `standingsSynced`, `matchesSynced`, `failedSteps`) con `@ApiProperty` en cada campo; método estático `SyncSummaryDto.fromDomain(summary: FootballDataSyncSummary): SyncSummaryDto`
- [X] T018 Crear `backend/src/controllers/competition/football-data-sync.controller.ts` con `FootballDataSyncController`: `@Controller('sync')`, `@ApiTags('sync')`, `@Public()`, `@UseGuards(ApiKeyGuard)`, `@ApiSecurity('ApiKeyAuth')`; endpoint `POST /sync/football-data` → llama `footballDataSyncService.triggerManualRun()`, responde `200` con `SyncSummaryDto`; `@ApiResponse` por código (200, 401, 409) según [contracts/sync-api.md](./contracts/sync-api.md)
- [X] T019 Actualizar `backend/src/modules/competition/football-data-sync.module.ts`: agregar `ApiKeyModule` a `imports`, agregar `ApiKeyGuard` a `providers`, registrar `FootballDataSyncController` en `controllers`; quitar el comentario "no expone controllers"

---

## Fase 4 — US3 + US4: tests e2e (P2)

Autenticación y respuesta no vacía, validadas de punta a punta con adapters fake y delay cero.

### Meta de US3 + US4
Sin ApiKey: 401 en los tres endpoints y sin corrida iniciada. Con ApiKey: resumen nunca vacío, incluso cuando el proveedor simula un fallo.

### Criterio de test independiente
`sync-trigger.e2e-spec.ts` verde; los tests existentes siguen verdes sin modificaciones.

- [X] T020 Crear `backend/test/sync-trigger.e2e-spec.ts` usando `createTestApp()` de `test-app.ts` con overrides de `WHOSCORED_ADAPTER` y `FOOTBALL_DATA_ADAPTER` por fakes, y `setRequestDelay(0)` sobre `FootballDataSyncService`; cubrir: (US3) POST `/sync/whoscored` sin header → 401, con JWT sin ApiKey → 401, con ApiKey revocada → 401; (US3) GET `/sync/whoscored/any-id` sin header → 401; (US3) POST `/sync/football-data` sin header → 401; (US1) POST `/sync/whoscored` con ApiKey → 202 con `runId` y `status: running`; (US1) GET `/sync/whoscored/:runId` hasta estado `completed` → resumen con `teamsSynced ≥ 0` y `failedUnits` array; (US1) segundo POST `/sync/whoscored` con corrida en curso → 409 con `runId`; (US1) GET con runId inexistente → 404; (US2) POST `/sync/football-data` con ApiKey → 200 con `leagues` y `failedLeagues`; (US2) segundo POST `/sync/football-data` con corrida en curso → 409 sin `runId`; (US4) ninguna respuesta de corrida completa tiene body vacío (verificado por los casos anteriores)

---

## Fase 5 — Polish

Documentación Postman (Swagger se genera desde decoradores ya puestos en T010 y T018).

- [X] T021 Actualizar `docs/postman/desapp.postman_collection.json`: agregar una carpeta "Feature 9 — Sincronización manual" con tres requests: `POST /sync/whoscored` (header `x-api-key: {{apiKey}}`, sin body, esperado 202), `GET /sync/whoscored/:runId` (header `x-api-key: {{apiKey}}`, variable `runId`, esperado 200), `POST /sync/football-data` (header `x-api-key: {{apiKey}}`, sin body, esperado 200); cada request con un ejemplo de response exitoso según [contracts/sync-api.md](./contracts/sync-api.md)

---

## Dependencias entre tareas

```text
T001, T002, T003, T004  →  paralelas entre sí (Fase 1)

T002 → T005, T006, T007, T008, T009      (tipos de dominio de WhoScored)
T003 → T013, T014, T015, T016, T017      (tipos de dominio de Football-Data)
T004 → T012, T020                         (test-app.ts con overrides)

T006 → T007                               (syncTeam con retorno antes del lock)
T007 → T010, T012                         (service completo antes del controller e integración)
T008, T009 → T010                         (DTOs antes del controller)
T010 → T011                               (controller antes del módulo)
T011 → T020                               (módulo registrado antes del e2e)

T014 → T016                               (standings con retorno antes de syncAllLeagues)
T015 → T016                               (matches con retorno antes de syncAllLeagues)
T016 → T018                               (service completo antes del controller)
T017 → T018                               (DTO antes del controller)
T018 → T019                               (controller antes del módulo)
T019 → T020                               (módulo registrado antes del e2e)

T010, T018 → T021                         (controllers con Swagger antes del Postman)
```

## Paralelismo por fase

**Fase 1** — T001, T002, T003, T004 son todas [P]: diferente archivo cada una, sin dependencias entre sí.

**Dentro de Fase 2** — T008 [P] y T009 [P] pueden hacerse en paralelo entre sí (DTOs distintos, solo comparten dependencia de T002).

**Fases 2 y 3** — pueden ejecutarse en paralelo entre sí después de Fase 1: US1 y US2 son features independientes que tocan archivos distintos.

## Implementación incremental

**MVP** (US1 + US3 para WhoScored): completar Fase 1 → T005–T011 → T020 (solo los casos de WhoScored). Esto entrega el endpoint asincrónico con autenticación y tests. Football-Data se agrega encima en Fase 3.

**Entrega completa**: completar las 5 fases en orden, validando con `pnpm test` tras cada fase.

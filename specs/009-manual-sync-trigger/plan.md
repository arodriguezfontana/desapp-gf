# Implementation Plan: Disparo manual de sincronización (WhoScored y Football-Data)

**Branch**: `main` (sin rama creada) | **Feature dir**: `specs/009-manual-sync-trigger/` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-manual-sync-trigger/spec.md`

## Summary

Se agregan tres endpoints protegidos con el `ApiKeyGuard` existente: `POST /sync/whoscored` (responde `202` con un `runId` y corre en background), `GET /sync/whoscored/:runId` (estado y resumen) y `POST /sync/football-data` (sincrónico, responde el resumen). Cada service de sincronización gana un lock en memoria que comparten el disparo manual y el `@Cron`: el manual que llega segundo recibe `409`, el `@Cron` que llega segundo se salta y se loguea. El estado de las corridas de WhoScored vive en un `Map` en memoria dentro del service.

Precondiciones (ya implementadas): `006-whoscored-catalog-sync`, `007-football-data-integration` y el `ApiKeyGuard` de `002-api-key-issuance`.

## Technical Context

**Language/Version**: TypeScript sobre NestJS 11 (backend). Sin dependencias nuevas: `@nestjs/schedule`, `@nestjs/swagger` y `node:crypto` ya están en uso.

**Storage**: Ninguna tabla nueva. El estado de corrida es un `Map<string, SyncRunState>` en memoria del proceso; se pierde si el servidor reinicia (aceptado en la spec).

**Testing**: Jest. Unit con mocks, integración contra Postgres efímero (Testcontainers) y e2e con supertest. Los tests nuevos van en **archivos nuevos**: ningún test existente se modifica (constitución IX; ver Decisión D1).

**Target Platform**: Servidor Linux (API REST), solo backend. Sin frontend (FR-011).

**Project Type**: Web, monorepo. Esta feature toca solo `backend/`, `docs/postman/` y `specs/`.

**Performance Goals**: `POST /sync/football-data` espera una corrida completa: 10 requests con 7 s de espera = ~70 s. Queda por debajo del `requestTimeout` por defecto de Node 20 (300 s). `POST /sync/whoscored` responde de inmediato, la corrida (varios minutos) sigue en background.

**Constraints**:
- Un solo proceso: el lock en memoria no coordina entre instancias (ver Complexity Tracking).
- Ningún secreto ni stack trace en las respuestas de estado (constitución III y IV).
- Ningún test existente se modifica ni se borra.

**Scale/Scope**: 3 endpoints, 2 controllers, 2 services modificados, 2 módulos modificados, 1 filtro modificado de forma aditiva, ~8 clases/DTOs nuevos.

## Constitution Check

*GATE: evaluado antes de Phase 0 y re-evaluado tras Phase 1. Constitución v1.8.0.*

| # | Principio | Estado | Cómo se cumple / nota |
|---|-----------|--------|-----------------------|
| I | Arquitectura en capas | ✅ | Controller → Service únicamente: los dos controllers nuevos solo llaman a su service; los tipos de resumen viven en `domain/`. No dependen de `repositories/` ni `adapters/` (el test tsarch lo verifica). El lock y el registro de corridas están en el Service (orquestación, no cálculo de negocio; ver Complexity Tracking). `SyncInProgressError` y `NotFoundException` salen del Service; `SyncInProgressError` es un `DomainError` puro (sin NestJS), mapeado por el filtro con su rama propia (ver D2). |
| II | Modelo de dominio rico | ✅ | Los tipos `WhoScoredSyncSummary`, `FootballDataSyncSummary` y `SyncRunState` son clases/tipos de dominio sin decoradores. No se agrega lógica de negocio a controllers. |
| III | Cada validación en su nivel | ✅ | 401 por el guard; 409/404 por excepciones HTTP del Service, mapeadas por el `AllExceptionsFilter` existente según `getStatus()` (verificado). El filtro **sí** requiere un cambio aditivo: hoy descarta cualquier campo extra del body, así que el `runId` del 409 se perdería (ver D2). |
| IV | Autenticación | ✅ | ApiKey en lugar de JWT, igual que `PlayerController` (decisión de diseño de la spec). Los logs del lock y del estado no incluyen la ApiKey ni datos personales. |
| V | Auditoría inmutable | ✅ (N/A) | No hay compra/venta de tokens. |
| VI | Integridad transaccional | ✅ (N/A) | No se agrega ninguna escritura multi-estado nueva; las transacciones de `applyTeamRosterSync` no cambian. |
| VII | Observabilidad | ⚠️ Parcial | El `@Cron` saltado se loguea como advertencia (FR-015). Sin correlation-ID ni métricas; deuda ya registrada en 001 y 008. |
| VIII | Documentación de la API | ✅ | Swagger desde decoradores en los tres endpoints (`@ApiSecurity('ApiKeyAuth')`, `@ApiResponse` 202/200/401/404/409). Sin edición manual del OpenAPI. |
| IX | Testing | ✅ | Unit + integración + e2e, todos en archivos nuevos. e2e con adapters reemplazados por fakes (sin red). Ningún test existente se toca. |
| X | Definición de terminado | ✅ | Tests verdes, `nest build` sin errores, Swagger actualizado, colección de Postman con los tres endpoints. |
| XI | Idioma | ✅ | Identificadores en inglés (`SyncRunState`, `startManualRun`); mensajes en español. |
| XII | Spec-first | ✅ | Deriva de `spec.md`. |

**Resultado del gate**: PASA. La desviación en VII ya estaba registrada; el cambio al filtro y el lock en el Service se justifican en Complexity Tracking.

## Decisiones que se apartan del pedido

Cuatro verificaciones en el código contradicen o ajustan lo que decía el pedido. Se resuelven así:

| ID | El pedido decía | Lo que encontré | Decisión |
|----|-----------------|-----------------|----------|
| D1 | El método `sync()` de WhoScored pasa a devolver el resumen. | Tres tests existentes exigen `await expect(service.sync()).resolves.toBeUndefined()` (`player-sync.service.spec.ts` líneas 116, 134 y 185) y uno más en el spec de integración (línea 165). Cambiar su retorno los rompe, y la constitución prohíbe tocarlos sin permiso. | `sync()` conserva su firma `Promise<void>` y sigue siendo el método del `@Cron`. Se agrega un método nuevo que devuelve el resumen. En Football-Data no hay este conflicto: los tests de `syncAllLeagues` no aseveran el retorno. |
| D2 | El filtro ya mapea `HttpException` por `getStatus()`, no necesita entrada para `ConflictException`. | Es cierto para el status. Pero el filtro arma el body solo con `statusCode`, `error`, `message`, `timestamp` y `path`: **un `runId` dentro del body del 409 se descarta**. Además, usar `ConflictException` acoplaría la excepción a NestJS, rompiendo el patrón del proyecto (todos los 409 del dominio —`ApiKeyAlreadyRevokedError`, `EmailAlreadyInUseError`— son `DomainError` puros sin importar NestJS). | Se crea `SyncInProgressError extends DomainError` (igual que los otros 409 del proyecto), con `runId` opcional. El filtro agrega su propia rama `instanceof SyncInProgressError → 409 + runId si viene`, igual que ya hace con `ApiKeyAlreadyRevokedError`. No se depende de `getStatus()` para este caso. |
| D3 | Lock como `isRunning: boolean`. | El 409 de WhoScored debe nombrar la corrida en curso, y también si la corrida en curso es la del `@Cron`. Un booleano no sabe cuál es. | WhoScored guarda `activeRunId: string \| null` (null = libre) y **el `@Cron` también genera un `runId`** y queda en el `Map`. Football-Data usa `isRunning: boolean` como pediste, porque no tiene `runId`. |
| D4 | — (la spec dejó abiertos estos casos para el plan) | — | `GET` con `runId` inexistente o perdido tras un reinicio: `404` con `NotFoundException`. Retención: las últimas 20 corridas, se descartan las terminadas más viejas. `POST /sync/football-data` responde `200` (no `201`: no se crea ningún recurso). |

## Project Structure

### Documentation (this feature)

```text
specs/009-manual-sync-trigger/
├── plan.md              # Este archivo
├── spec.md              # Especificación (existe)
├── research.md          # Phase 0 — decisiones técnicas
├── data-model.md        # Phase 1 — estado de corrida y resúmenes
├── quickstart.md        # Phase 1 — validación end-to-end
├── contracts/
│   └── sync-api.md      # Contrato de los tres endpoints
├── checklists/
│   └── requirements.md  # (existe)
└── tasks.md             # Phase 2 — /speckit-tasks, NO lo crea /speckit-plan
```

### Source Code (repository root)

```text
backend/src/
├── domain/
│   ├── player/sync-run.ts                                   # NUEVO — WhoScoredSyncSummary, SyncFailedUnit, SyncRunState, SyncRunStatus
│   └── competition/sync-summary.ts                          # NUEVO — LeagueSyncResult, FootballDataSyncSummary
├── services/
│   ├── player-sync/
│   │   ├── player-sync.service.ts                           # MODIFICADO — lock (activeRunId) + Map de corridas; sync() sigue void; nuevos startManualRun() y getRun(); syncTeam devuelve resultado
│   │   ├── player-sync.service.manual-run.spec.ts           # NUEVO — lock, 409, runId, estados, retención
│   │   └── player-sync.service.manual-run.integration.spec.ts  # NUEVO — corrida real contra Postgres con adapter fake
│   └── competition/
│       ├── football-data-sync.service.ts                    # MODIFICADO — isRunning + triggerManualRun(); syncAllLeagues y los pasos por liga devuelven resultado
│       └── football-data-sync.service.manual-run.spec.ts    # NUEVO
├── controllers/
│   ├── player-sync/
│   │   ├── player-sync.controller.ts                        # NUEVO — POST /sync/whoscored (202), GET /sync/whoscored/:runId
│   │   └── dto/
│   │       ├── sync-accepted.dto.ts                         # NUEVO — SyncAcceptedDto (runId, status)
│   │       └── sync-run-status.dto.ts                       # NUEVO — SyncRunStatusDto
│   └── competition/
│       ├── football-data-sync.controller.ts                 # NUEVO — POST /sync/football-data (200)
│       └── dto/
│           └── sync-summary.dto.ts                          # NUEVO — SyncSummaryDto
├── modules/
│   ├── player-sync/player-sync.module.ts                    # MODIFICADO — imports ApiKeyModule; provee ApiKeyGuard; registra el controller
│   └── competition/football-data-sync.module.ts             # MODIFICADO — idem; el comentario "no expone controllers" se actualiza
├── shared/
│   ├── errors/messages.ts                                   # MODIFICADO — SYNC_IN_PROGRESS_MESSAGE, SYNC_RUN_NOT_FOUND_MESSAGE
│   └── filters/
│       ├── all-exceptions.filter.ts                         # MODIFICADO (aditivo) — rama instanceof SyncInProgressError → 409 + runId opcional
│       └── all-exceptions.filter.runid.spec.ts              # NUEVO — caso del runId (el spec existente no se edita)

backend/test/
├── test-app.ts                                              # MODIFICADO (aditivo) — parámetro opcional para reemplazar providers
└── sync-trigger.e2e-spec.ts                                 # NUEVO — 401, 202 + GET, 409, football-data síncrono

docs/postman/desapp.postman_collection.json                  # MODIFICADO — carpeta "Feature 9 — Sincronización manual"
```

**Structure Decision**: Se respeta la estructura por capas ya usada. Cada controller vive en la carpeta de su feature (`controllers/player-sync/`, `controllers/competition/`), igual que `controllers/player/`. Los services no se reorganizan: el lock y el `Map` se agregan en los mismos archivos que ya contienen el `@Cron`. Los módulos siguen el patrón de `PlayerModule`: importan `ApiKeyModule` y declaran `ApiKeyGuard` como provider.

## Complexity Tracking

| Violación / decisión | Por qué es necesaria | Alternativa más simple, y por qué se rechaza |
|----------------------|----------------------|----------------------------------------------|
| Principio VII parcial | Igual que 001 y 008: la feature es correcta sin ese stack. | Stack de observabilidad ahora: fuera de alcance, ya diferido. |
| Lock y registro de corridas en el Service, no en el dominio | Es control de concurrencia operativo de un solo proceso, no una regla de negocio. La constitución II reserva al dominio el cálculo de negocio y la VI, la atomicidad de cambios de estado de negocio. | Clase de dominio `SyncLock`: agrega una pieza sin lógica de negocio que proteger. |
| Lock en memoria, válido solo en un proceso | Es la decisión de la spec y evita infraestructura nueva. Con dos instancias del backend dos corridas podrían solaparse. | Lock en base de datos o advisory lock de Postgres: más robusto, pero infraestructura que el alcance no pidió. Riesgo registrado en research R7. |
| `NotFoundException` lanzada desde el Service | Las HTTP exceptions se mapean sin tocar el filtro (verificado). | `DomainError` con entrada propia en el filtro: más puro, pero modifica el filtro para cada caso. |
| `SyncInProgressError extends DomainError` (no `ConflictException`) + cambio aditivo al `AllExceptionsFilter` | Sin el `DomainError` propio, la excepción rompe el patrón del proyecto (ver D2). Sin el cambio al filtro, el `runId` no llega al cliente. | `ConflictException` de NestJS: se rechaza, acopla el dominio a Nest, inconsistente con `ApiKeyAlreadyRevokedError` y `EmailAlreadyInUseError`. Poner el `runId` en el texto del mensaje: no es un campo estructurado. |

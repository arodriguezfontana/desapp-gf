# Research: Disparo manual de sincronización

**Feature**: `009-manual-sync-trigger` | **Date**: 2026-10-06

Formato: Decision / Rationale / Alternatives. No quedaron NEEDS CLARIFICATION.

---

## R1. El método de WhoScored no cambia de firma

**Decision**: `PlayerSyncService.sync(): Promise<void>` se mantiene tal cual como método del `@Cron`. Se agrega `startManualRun(): string` (devuelve el `runId` y arranca la corrida en background), `getRun(runId): SyncRunState` y un método privado que ejecuta la corrida y devuelve `WhoScoredSyncSummary`. `sync()` pasa a ser: respetar el lock, ejecutar la corrida, descartar el resumen (queda guardado en el `Map`).

**Rationale**: tres tests de `player-sync.service.spec.ts` y uno de integración aseveran `resolves.toBeUndefined()` sobre `sync()`. Cambiar el retorno los rompe y la constitución IX exige permiso explícito para tocarlos. `run-sync.ts` (script manual en la raíz del backend) también llama a `sync()`.

**Alternatives considered**:
- Cambiar el retorno de `sync()` y editar esos cuatro tests: se rechaza, requiere un "sí" que no está dado.
- Duplicar el cuerpo de `sync()` en un método nuevo: se rechaza, dos copias de la misma lógica.

## R2. Football-Data: el retorno sí cambia

**Decision**: `syncAllLeagues()`, `syncStandingsForLeague()` y `syncMatchesForLeague()` pasan de `Promise<void>` a devolver resultado (`FootballDataSyncSummary` y un `{ synced, failed }` por paso). El lock vive en un método privado compartido; `handleCron()` y el nuevo `triggerManualRun()` lo usan. `syncAllLeagues()` queda sin lock, como hoy, porque el spec de integración lo llama directamente.

**Rationale**: los métodos por liga atrapan el error del adapter y lo loguean (el adapter relanza, el service lo traga). Sin un valor de retorno no hay forma de informar qué liga falló (FR-008). Verifiqué los tests: ninguno aserta `undefined` sobre estos métodos (solo `resolves.not.toThrow()`, que acepta cualquier valor). Se confirma al implementar.

**Alternatives considered**:
- Dejar los pasos en `void` y contar con logs: se rechaza, no es un resumen.
- Que el paso relance el error y lo atrape `syncAllLeagues`: cambia el comportamiento ante fallo (hoy una liga caída no corta las demás); se rechaza.

## R3. Guard: reuso tal cual

**Decision**: los dos controllers usan `@Public()` + `@UseGuards(ApiKeyGuard)` + `@ApiSecurity('ApiKeyAuth')`, igual que `PlayerController`. Cada módulo importa `ApiKeyModule` (que exporta `API_KEY_REPOSITORY` y `TOKEN_HASHER`) y declara `ApiKeyGuard` en `providers`, como hace `PlayerModule`.

**Rationale**: es el patrón ya probado; `@Public()` exime del `JwtAuthGuard` global y un JWT válido nunca alcanza al guard. El `GET` de estado usa el mismo guard (FR-005, FR-006).

**Alternatives considered**: `AdminApiKeyGuard` (spec 008): se rechaza, la spec dice que cualquier ApiKey válida alcanza (riesgo aceptado).

## R4. Filtro global: `SyncInProgressError` como `DomainError`, rama propia en el filtro

**Decision**: Se crea `SyncInProgressError extends DomainError` — igual que `ApiKeyAlreadyRevokedError` y `EmailAlreadyInUseError`, sin importar NestJS. `AllExceptionsFilter.resolve()` gana una rama explícita `instanceof SyncInProgressError → 409 + runId opcional`, antes del catch-all de `HttpException`. `NotFoundException` (para el GET con `runId` inexistente) sí usa la rama genérica de `HttpException` porque no necesita campos extra en el body. Se agrega `runId?: string` a `ErrorBody` y a `resolve()`; el body lo incluye solo si viene definido.

**Rationale**: usar `ConflictException` de NestJS acoplaría el dominio a Nest: todos los 409 actuales del proyecto son `DomainError` puros mapeados por el filtro con `instanceof`. Mantener ese patrón es más consistente y permite que el filtro controle qué campo extra (solo `runId`, nada más) llega al cliente.

**Alternatives considered**: `ConflictException` con `runId` en el body y el filtro copiándolo genéricamente (se rechaza: acopla dominio a Nest, inconsistente con el resto del proyecto); copiar todo campo extra de la respuesta (se rechaza, fuga potencial); meter el `runId` en el texto del mensaje (se rechaza, no estructurado).

## R5. Lock y `runId` de WhoScored

**Decision**: `activeRunId: string | null` es el lock. `startManualRun()` y `sync()` hacen la comprobación y la asignación en el mismo tick sincrónico (sin `await` entre medio), así que no hay carrera dentro del proceso. La liberación va en un `finally`. El `@Cron` genera su propio `runId` y entra al `Map`, de modo que el 409 puede nombrar la corrida en curso aunque sea del `@Cron`.

**Rationale**: el check-and-set sin `await` es atómico en el event loop de Node. Que el `@Cron` registre su corrida es lo que permite cumplir "el body del 409 incluye el runId de la corrida en curso" cuando esa corrida no es manual.

**Alternatives considered**: booleano más búsqueda en el `Map` de la corrida con estado `running` (equivalente, pero más lento y con un estado derivado); no registrar corridas del `@Cron` (se rechaza, el 409 quedaría sin `runId`).

## R6. Retención, `runId` desconocido y estado `failed`

**Decision**:
- El `Map` conserva las últimas 20 corridas (`MAX_RETAINED_RUNS`). Al superar el tope se descarta la terminada más vieja; nunca la que está `running`.
- `GET` con un `runId` que no está en el `Map` (inexistente, descartado o perdido por reinicio) responde 404 con `SYNC_RUN_NOT_FOUND_MESSAGE`.
- `completed` = la corrida llegó al final, con o sin unidades fallidas. `failed` = un error no controlado abortó la corrida; guarda los conteos hasta ese punto y un mensaje genérico, sin stack ni texto de la excepción.

**Rationale**: el uso semanal más los disparos manuales hacen que 20 alcance de sobra y mantiene la memoria acotada. El mensaje genérico cumple III.

## R7. Límites del lock en memoria (riesgo conocido)

**Decision**: el lock solo vale dentro de un proceso. Con más de una instancia del backend, el `@Cron` de cada una y los disparos manuales podrían solaparse. Se acepta: hoy hay una instancia y la spec elige el lock en memoria. Lo que se pierde con un reinicio es el estado de las corridas; una corrida en curso se corta con el proceso.

**Alternatives considered**: advisory lock de Postgres: resuelve el multi-instancia, pero es infraestructura nueva que el alcance no pidió.

## R8. Football-Data sincrónico: tiempo y límite de requests

**Decision**: `POST /sync/football-data` espera una corrida completa. Son 10 requests con `requestDelayMs = 7000` entre cada una, unos 70 s, por debajo del `requestTimeout` por defecto de Node 20 (300 s). Un segundo POST durante ese tiempo recibe 409 sin esperar. El límite del plan free (10 req/min) lo respeta el delay que ya existe; no se toca.

**Rationale**: el lock evita justo el caso que rompía el espaciado (dos corridas solapadas, ya observado como 429). No hay manejo de 429 en el adapter: un 429 se registra como fallo de esa liga y aparece en `failedLeagues`.

## R9. Estrategia de tests sin red ni 70 segundos

**Decision**: `createTestApp()` recibe un parámetro opcional para reemplazar providers (`overrideProvider`), sin cambiar su uso actual. El e2e reemplaza `WHOSCORED_ADAPTER` y `FOOTBALL_DATA_ADAPTER` por fakes y pone `setRequestDelay(0)` en el service de Football-Data (el método ya es público). La prueba del 409 usa un adapter fake que espera una señal controlada por el test.

**Rationale**: el e2e carga `AppModule` real; sin reemplazo, el disparo llamaría a WhoScored y a Football-Data de verdad.

## R10. Cobertura de `@Cron`

**Decision**: el horario (`CronExpression.EVERY_WEEK`) y `waitForCompletion: true` no se tocan (FR-004). Se agrega un test unitario que verifica el decorador sobre `sync()` y `handleCron()` y el comportamiento de saltarse la ejecución cuando el lock está tomado.

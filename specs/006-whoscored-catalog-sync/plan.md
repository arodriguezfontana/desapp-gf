# Implementation Plan: Catálogo de Jugadores con Datos Reales (WhoScored)

**Branch**: `006-whoscored-catalog-sync` | **Feature dir**: `specs/006-whoscored-catalog-sync/` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-whoscored-catalog-sync/spec.md`

## Correcciones a las precondiciones del pedido

Ver [research.md §0](./research.md#0-correcciones-a-las-precondiciones-del-pedido).
Resumen: `@nestjs/schedule` **no** está instalado (esta feature lo agrega); el
fixture HTML de WhoScored **no** existe todavía en el repo (capturarlo y
versionarlo es parte del alcance). El resto de las precondiciones (`Player`
TypeORM, `GET /players`/`GET /players/:id`, `ApiKeyGuard`, Docker) se
verificaron correctas y no se tocan.

Además, dos de las "decisiones técnicas" del pedido tensionan con la spec ya
cerrada con el usuario y se reconcilian explícitamente:

- **"Sincronización todo-o-nada"** (pedido) vs. **tres niveles independientes
  liga/equipo/jugador** (spec FR-014 a FR-016, ya corregida dos veces con el
  usuario): se adopta todo-o-nada, pero acotado a la unidad atómica que la
  spec define — **por equipo** — no a las 5 ligas completas. Ver
  [research.md §1](./research.md#1-reconciliación-todo-o-nada-del-pedido-vs-la-granularidad-ya-fijada-en-la-spec).
- **"Upsert por id externo, no reemplazo total, para no perder cotizaciones"**
  (pedido) vs. **un jugador que sale del plantel MUST responder 404** (spec
  FR-016): se resuelve con baja lógica (`removedAt`, mismo patrón que
  `ApiKeyEntity.revokedAt`) — la fila persiste (protege una futura FK de
  cotizaciones) pero la lectura la filtra (`WHERE removed_at IS NULL`), así
  que el contrato de API (404, ausente del listado) se cumple igual. Ver
  [research.md §2](./research.md#2-reconciliación-upsert-no-reemplazo-total-para-no-perder-cotizaciones-vs-fr-016-baja--404).

## Summary

Reemplazar los 20 jugadores ficticios de `004-player-catalog` por datos reales
de las mismas 5 ligas, obtenidos por un `WhoScoredAdapter` propio (scraping de
páginas de plantel de equipo y de `matchstatistics` por jugador, axios +
cheerio) detrás de una interfaz de dominio — mismo patrón que
`PasswordHasher`/`TokenIssuer`/`TokenHasher`. Un `PlayerSyncService` nuevo, no
expuesto a clientes, dispara `@Cron(CronExpression.EVERY_WEEK)`, itera las 5
ligas, y por cada equipo: mapea el código de posición fino de WhoScored al
enum propio (función pura de dominio, tabla ya fijada en la spec), excluye y
loguea los códigos no reconocidos y las fallas puntuales de la página de
stats de un jugador, y aplica el resultado como una única transacción de
upsert-por-`externalId` + baja lógica (`removedAt`) por equipo. Un fallo de
red o timeout en la lista de equipos de una liga o en el plantel de un equipo
sólo saltea esa liga/equipo esa corrida (FR-014/015): el resto de la corrida
sigue. `GET /players`/`GET /players/:id` no cambian de contrato salvo por
cuatro campos nuevos y nullable en la respuesta (métricas de rendimiento);
siguen leyendo sólo del `PlayerRepository`, nunca del Adapter ni disparan
sincronización (FR-008/009).

## Technical Context

**Language/Version**: TypeScript 5.7 sobre Node.js 20, NestJS 11 (sin cambios).

**Primary Dependencies**: nuevas — `@nestjs/schedule` (scheduler `@Cron`),
`axios` (HTTP del Adapter, con timeout), `cheerio` (parseo de HTML
server-rendered de WhoScored). Reusadas sin cambios: `@nestjs/typeorm`/
`typeorm`, `class-validator`/`class-transformer`, `@nestjs/swagger`.

**Storage**: mismo Postgres/`DATABASE_URL` (`database.module.ts` no se toca).
Tabla `players` extendida con 6 columnas nuevas (`external_id`, `removed_at`,
`passes_completed`, `shots`, `interceptions`, `rating`) vía 2 migrations
nuevas que corren con la infra ya existente (`player-catalog-data-source.ts`/
`run-player-catalog-migrations.ts`, sin cambios). Ver data-model.md.

**Testing**: Jest + supertest + Testcontainers (mismo patrón ya establecido).
Nuevo: unit de dominio puro (`mapWhoScoredPosition`, `computePlayersToRemove`,
sin Nest/DB); unit de `HttpWhoScoredAdapter` con `axios` mockeado resolviendo
el fixture HTML capturado (parseo real vía `cheerio`, sin red); unit de
`PlayerSyncService` con un `WhoScoredAdapter` fake (sin HTTP) y
`PlayerRepository` mockeado, cubriendo los 3 niveles de falla (liga/equipo/
jugador) y ambos casos de `metrics`/`metricsFetchFailed`; integración de
`TypeOrmPlayerRepository.applyTeamRosterSync`/`findActiveExternalIdsByTeam`
contra Postgres real (Testcontainers); e2e de `GET /players`/`GET /players/:id`
sembrando filas directamente (sin depender del scraping real, mismo criterio
que ya usa `player-catalog.e2e-spec.ts`).

**Target Platform**: mismo backend server, sin cambios de plataforma.

**Project Type**: Web — monorepo `backend/` + `frontend/`. Backend-only: el
scheduler y el Adapter son procesos internos; el frontend no se toca (los 4
campos nuevos son aditivos al JSON, no rompen el consumo actual).

**Performance Goals**: sin metas nuevas sobre el camino de lectura (sigue
siendo Postgres + `WHERE`/`LIMIT`/`OFFSET`, ahora con un `removed_at IS NULL`
adicional — índice trivial a este volumen). La sincronización es un proceso
de background semanal, no tiene meta de latencia de request.

**Constraints**:
- `PlayerSyncService`/`WhoScoredAdapter` MUST NOT ser importados por
  `PlayerController`/`PlayerService` (verificado por un tsarch nuevo, ver
  Constitution Check Principio IX).
- Timeout de 15000ms por request HTTP del Adapter
  (`WHOSCORED_REQUEST_TIMEOUT_MS`) — research.md §6.
- Sin lock de solapamiento entre corridas de `@Cron` (research.md §6,
  decisión explícita de no agregar esa complejidad).
- `axios`/`cheerio` sólo se importan dentro de `adapters/`.

**Scale/Scope**: ~2500-3000 páginas de `matchstatistics` por corrida completa
(research.md §6). 1 tabla extendida (6 columnas nuevas), 2 migrations nuevas,
1 Adapter nuevo (puerto + implementación), 1 Service nuevo, 2 funciones puras
de dominio nuevas, 2 métodos nuevos en el puerto del repositorio, 1 módulo
nuevo (`PlayerSyncModule`), ~20 archivos nuevos y ~8 archivos existentes con
un cambio puntual cada uno (ninguno de ellos es `PlayerController` ni
`PlayerService`).

## Constitution Check

*GATE: evaluado antes de Phase 0 y re-evaluado tras Phase 1. Constitución v1.8.0.*

| # | Principio | Estado | Cómo se cumple / nota |
|---|-----------|--------|-----------------------|
| I | Arquitectura en capas | ✅ | `WhoScoredAdapter` es la única puerta de entrada a WhoScored (interfaz de dominio en `adapters/`, implementación `HttpWhoScoredAdapter` con axios+cheerio detrás). `PlayerSyncService` (Service) nunca importa axios/cheerio, sólo el puerto — verificado por un tsarch nuevo (ver Principio IX). `PlayerSyncService` recibe/devuelve tipos de dominio (`PlayerSyncInput`, `League`, `Position`), nunca `PlayerEntity`; la única capa que ve `PlayerEntity` sigue siendo `TypeOrmPlayerRepository`/`PlayerMapper`. Degradación ante fallo del proveedor: FR-010/FR-014/FR-015 — una liga o equipo que falla no afecta a los demás ni al catálogo ya servido (research.md §1). |
| II | Modelo de dominio rico | ✅ (alcance acotado) | `mapWhoScoredPosition` (tabla de mapeo) y `computePlayersToRemove` (diff de altas/bajas) son funciones puras de dominio, testeadas en aislamiento. Sigue sin haber Strategy pattern de valuación: esta feature no calcula scores, sólo enriquece el catálogo con datos e métricas crudas. |
| III | Cada validación en su nivel | ✅ | Sin cambios en el nivel de validación de `GET /players`/`GET /players/:id` (DTO para `page`/`pageSize`, dominio para `league`/`position` de filtro). El código de posición de WhoScored no es un "input de cliente" a rechazar con 400: es una política de negocio de la sincronización (excluir + loguear, FR-012), resuelta en `PlayerSyncService`, no en un DTO ni con una excepción de dominio nueva. |
| IV | Autenticación | ✅ (sin cambios) | `ApiKeyGuard` intacto; `PlayerSyncService` no es un endpoint HTTP, no tiene ni necesita autenticación propia (FR-008: nunca se dispara por una request). |
| V | Auditoría inmutable | N/A | Sin compra/venta de tokens en esta feature. |
| VI | Integridad transaccional | ✅ | El "todo-o-nada" por equipo (research.md §1) es una única transacción (`applyTeamRosterSync`, patrón ya usado por `TypeOrmApiKeyRepository.saveWithRevocation`). La lógica que define **qué** cambios forman esa unidad (altas vs. bajas) vive en el dominio (`computePlayersToRemove`), no en el Service ni el Repository — el Repository sólo ejecuta atómicamente lo que el dominio ya resolvió. |
| VII | Observabilidad | ✅ (para esta feature) | Log de revisión manual (FR-013/FR-018) vía `Logger` estructurado nombrado (`PlayerSyncManualReview`), mismo mecanismo que ya exige este principio y que ya usa `AllExceptionsFilter` — sin tabla nueva (research.md §9). Fallas de liga/equipo también quedan logueadas para diagnóstico (FR-010, Edge Cases). Deuda preexistente de Correlation-ID/métricas (heredada de `001-user-auth`) no se agrava ni se resuelve acá. |
| VIII | Documentación de la API | ✅ | `PlayerResponseDto` agrega 4 `@ApiProperty({ nullable: true })`. Sin esquema de seguridad nuevo. OpenAPI sigue generándose desde los DTOs, no a mano. |
| IX | Testing | ✅ | Ver Technical Context § Testing arriba para el detalle unit/integración/e2e. Se agrega **una regla nueva** a `backend/test/architecture.spec.ts`: el Service no debe importar `axios`/`cheerio` directo (mismo patrón ya usado para `bcrypt`), garantizando que sólo `adapters/http-whoscored-adapter.ts` scrapea. Ningún test pega contra `whoscored.com` real (fixture HTML capturado + `axios` mockeado en el Adapter; fake sin HTTP en `PlayerSyncService`) — research.md §8. |
| X | Definición de terminado | ✅ | Contempla tests unit+integración+e2e en verde, `nest build` sin errores, Swagger actualizado (4 campos nuevos nullable), y la colección Postman actualizada si versiona el ejemplo de respuesta de `GET /players`/`GET /players/:id`. |
| XI | Idioma | ✅ | Identificadores en inglés (`PlayerSyncService`, `WhoScoredAdapter`, `mapWhoScoredPosition`, `computePlayersToRemove`). Mensajes de log y campos conceptuales de la spec en español donde ya lo estaban; nombres de campo del JSON en inglés (`passesCompleted`, etc.), mismo criterio que el resto del contrato. |
| XII | Spec-first | ✅ | Deriva de `specs/006-whoscored-catalog-sync/spec.md`; las dos tensiones entre el pedido técnico y la spec ya cerrada quedan resueltas y documentadas explícitamente arriba y en research.md §1-§2, no silenciadas. |

**Resultado del gate**: PASA. Sin violaciones que requieran justificación en
Complexity Tracking; las dos reconciliaciones (granularidad "todo-o-nada" y
"upsert vs. baja") son decisiones de diseño documentadas, no desviaciones de
la constitución.

## Project Structure

### Documentation (this feature)

```text
specs/006-whoscored-catalog-sync/
├── plan.md                          # Este archivo
├── spec.md                          # Especificación (ya existe)
├── research.md                      # Phase 0 — decisiones técnicas y reconciliaciones
├── data-model.md                    # Phase 1 — entidades, puertos, migrations
├── quickstart.md                    # Phase 1 — guía de validación end-to-end
├── contracts/
│   ├── player-api.md                # Diff del contrato REST (4 campos nuevos)
│   └── whoscored-adapter.md         # Contrato interno del Adapter + contrato de test
├── checklists/
│   └── requirements.md              # (ya existe)
└── tasks.md                         # Phase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── package.json                                        # + @nestjs/schedule, axios, cheerio
└── src/
    ├── app.module.ts                                    # + import PlayerSyncModule
    ├── player.module.ts                                 # + exports: [PLAYER_REPOSITORY] (para que PlayerSyncModule lo reuse)
    ├── player-sync.module.ts                             # NUEVO — importa PlayerModule + ScheduleModule.forRoot()
    ├── player-sync.constants.ts                          # NUEVO — WHOSCORED_ADAPTER, WHOSCORED_REQUEST_TIMEOUT_MS
    ├── domain/
    │   └── player/
    │       ├── player.ts                                 # + 4 campos nullable (passesCompleted/shots/interceptions/rating)
    │       ├── player.spec.ts                             # + casos con métricas null/con valor
    │       ├── player-sync-input.ts                       # NUEVO — PlayerSyncInput, PlayerMetrics
    │       ├── whoscored-position-mapping.ts               # NUEVO — mapWhoScoredPosition (función pura)
    │       ├── whoscored-position-mapping.spec.ts           # NUEVO — 1 caso por categoría + no reconocido
    │       ├── team-roster-sync.ts                          # NUEVO — computePlayersToRemove (función pura)
    │       └── team-roster-sync.spec.ts
    ├── adapters/
    │   ├── whoscored-adapter.ts                            # NUEVO — puerto (interface) + tipos crudos
    │   ├── http-whoscored-adapter.ts                        # NUEVO — axios + cheerio
    │   └── http-whoscored-adapter.spec.ts                    # NUEVO — axios mockeado + fixture HTML real
    ├── repositories/
    │   ├── player.repository.ts                             # + findActiveExternalIdsByTeam, applyTeamRosterSync
    │   ├── typeorm-player.repository.ts                       # + WHERE removed_at IS NULL; + 2 métodos nuevos (transacción)
    │   ├── entities/
    │   │   └── player.entity.ts                              # + externalId, removedAt, passesCompleted, shots, interceptions, rating
    │   └── mappers/
    │       └── player.mapper.ts                               # + mapeo de las 4 métricas nuevas
    ├── services/
    │   ├── player.service.ts                                  # SIN CAMBIOS (sigue sólo con PLAYER_REPOSITORY)
    │   ├── player-sync.service.ts                              # NUEVO — orquesta liga/equipo/jugador
    │   ├── player-sync.service.spec.ts                          # NUEVO — WhoScoredAdapter fake + repo mockeado
    │   └── player-sync.service.integration.spec.ts               # NUEVO — contra Postgres real (Testcontainers)
    ├── controllers/
    │   └── dto/player/
    │       └── player-response.dto.ts                          # + 4 campos nullable
    └── database/
        └── migrations/
            └── 1758150000000-RemoveTestPlayerCatalogSeed.ts       # NUEVO — sólo datos; el esquema lo agrega `synchronize` desde PlayerEntity

backend/test/
├── architecture.spec.ts                                   # + regla: Service no importa axios/cheerio directo
├── fixtures/whoscored/
│   └── <player-id>-matchstatistics.html                    # NUEVO — HTML real capturado y versionado
└── player-catalog.e2e-spec.ts                              # + casos con las 4 métricas (valor y null)

docs/postman/desapp.postman_collection.json                 # ejemplo de respuesta de GET /players actualizado
```

**Structure Decision**: mismo monorepo y misma organización por capa de
`backend/src/` ya vigente (`controllers/`, `services/`, `domain/<feature>/`,
`repositories/`, `adapters/`, `guards/`). `PlayerSyncModule` es un módulo
nuevo, separado de `PlayerModule`, para mantener el lado de lectura
(`PlayerController`/`PlayerService`, ya estable desde `004`) completamente
libre de cualquier dependencia del scraper — `PlayerModule` sólo necesita
exportar su token `PLAYER_REPOSITORY` para que `PlayerSyncModule` lo reuse,
sin exponer nada del Adapter ni del scheduler hacia el lado de lectura.

## Complexity Tracking

> No hay violaciones del Constitution Check que requieran esta tabla. Las dos
> reconciliaciones entre el pedido técnico y la spec (granularidad
> "todo-o-nada" acotada a equipo/liga, y "upsert con baja lógica" en vez de
> "nunca borrar") están documentadas arriba y en research.md §1-§2 como
> decisiones de diseño que **cumplen ambos** requisitos en capas distintas,
> no como desviaciones que necesiten una alternativa más simple descartada.

## Phase 0 — Research

Ver [research.md](./research.md). Resuelve: las correcciones de precondición
(`@nestjs/schedule`, fixture inexistente), las dos reconciliaciones pedido/spec
(granularidad, upsert-vs-baja), la forma del puerto `WhoScoredAdapter`, la
elección de axios+cheerio sobre un browser headless, el diseño de
`mapWhoScoredPosition` y `computePlayersToRemove` como funciones puras, el
volumen/timeout/ausencia de lock de solapamiento, la frecuencia semanal del
`@Cron`, el criterio de test determinístico con fixture HTML, y la decisión
de loguear en vez de crear una tabla de revisión manual.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): `Player` extendido (4 métricas nullable),
  `PlayerSyncInput`/`PlayerMetrics`, `mapWhoScoredPosition`,
  `computePlayersToRemove`, `PlayerEntity` extendida (6 columnas + 2
  migrations), `PlayerRepository` extendido (`findActiveExternalIdsByTeam`,
  `applyTeamRosterSync`), y el flujo completo de `PlayerSyncService.sync()`.
- [contracts/player-api.md](./contracts/player-api.md): diff del contrato
  REST ya vigente — sólo los 4 campos nuevos y nullable.
- [contracts/whoscored-adapter.md](./contracts/whoscored-adapter.md):
  contrato del puerto `WhoScoredAdapter`, semántica de `metrics`/
  `metricsFetchFailed`, y el contrato de test basado en fixture HTML.
- [quickstart.md](./quickstart.md): pasos para instalar las dependencias
  nuevas, correr las migrations, disparar una sincronización manual en local,
  y validar filtros/paginación/métricas/degradación con la suite automatizada.

## Post-Design Constitution Re-Check

Sin cambios respecto del gate inicial: el diseño de Phase 1 mantiene el
Adapter como única puerta a WhoScored, concentra la política de
mapeo/exclusión y el diff de altas/bajas en funciones puras de dominio,
ejecuta la atomicidad por equipo en una única transacción de repositorio, y
no introduce ningún endpoint ni mecanismo de autenticación nuevo. La regla de
tsarch nueva (Service no importa axios/cheerio) es una extensión del mismo
patrón ya existente, no una excepción. Sin desviaciones nuevas que registrar.

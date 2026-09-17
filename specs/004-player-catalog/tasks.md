---

description: "Task list template for feature implementation"
---

# Tasks: Catálogo de Jugadores (datos de prueba)

**Input**: Design documents from `specs/004-player-catalog/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/player-api.md, quickstart.md (todos existentes)

**Tests**: Incluidos como tareas obligatorias — la constitución (Principio IX, Principio X) exige unit + integración + e2e con casos felices y borde para todo requerimiento, no son opcionales en este proyecto.

**Organización**: Tareas agrupadas por user story (spec.md: US1 y US2 son P1, US3 es P2) para permitir implementación y prueba independientes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: A qué user story pertenece (US1, US2, US3)
- Cada tarea incluye la ruta exacta del archivo

## Path Conventions

Monorepo web existente. Esta feature es backend-only: `backend/src/`, `backend/test/`, más un archivo compartido en `docs/postman/`. Estructura y rutas exactas: [plan.md § Project Structure](./plan.md#project-structure).

---

## Phase 1: Setup

**Purpose**: Preparar la infraestructura compartida de ApiKey y de scripts que el resto de la feature reutiliza. Sin dependencias nuevas de `npm` (research.md).

- [X] T001 [P] Agregar `API_KEY_HEADER = 'x-api-key'` a `backend/src/api-key.constants.ts` (junto a `API_KEY_PREFIX` existente)
- [X] T002 [P] Exportar `API_KEY_REPOSITORY` y `TOKEN_HASHER` desde `backend/src/api-key.module.ts` (agregar `exports: [...]`) para que `PlayerModule` los reuse (research.md §1)
- [X] T003 [P] Agregar scripts `migration:run` y `migration:generate` a `backend/package.json` usando el binario `typeorm-ts-node-commonjs` ya presente, apuntando a `backend/src/database/player-catalog-data-source.ts` (research.md §2)

**Checkpoint**: constantes y exports listos; nada de esto rompe `001`/`002` (son sólo adiciones).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Dominio, persistencia, migration de seed y `ApiKeyGuard` — infraestructura que **ambos** endpoints (US1 y US2) necesitan desde el primer commit, y que el propio `ApiKeyGuard` (US3) exige que exista para que ningún endpoint quede desprotegido ni un instante.

**⚠️ CRITICAL**: ningún endpoint de `PlayerController` puede implementarse antes de que esta fase esté completa.

### Dominio (`domain/player/`)

- [X] T004 [P] Crear `InvalidLeagueError` (extiende `DomainError`) en `backend/src/domain/player/errors/invalid-league.error.ts`
- [X] T005 [P] Crear `InvalidPositionError` (extiende `DomainError`) en `backend/src/domain/player/errors/invalid-position.error.ts`
- [X] T006 [P] Crear `PlayerNotFoundError` (extiende `DomainError`) en `backend/src/domain/player/errors/player-not-found.error.ts`
- [X] T007 Crear enum `League` (5 valores, data-model.md) + `parseLeague(value: string): League` que lanza `InvalidLeagueError` si no matchea, en `backend/src/domain/player/league.ts` (depende de T004)
- [X] T008 Crear enum `Position` (GK/DF/MF/FW) + `parsePosition(value: string): Position` que lanza `InvalidPositionError` si no matchea, en `backend/src/domain/player/position.ts` (depende de T005)
- [X] T009 Crear clase de dominio `Player` (id, name, League, team, Position; factory `Player.restore(...)`, sólo getters) en `backend/src/domain/player/player.ts` (depende de T007, T008)
- [X] T010 [P] Unit tests de `League`/`parseLeague` (los 5 valores válidos + valor inválido → `InvalidLeagueError`) en `backend/src/domain/player/league.spec.ts`
- [X] T011 [P] Unit tests de `Position`/`parsePosition` (los 4 valores válidos + valor inválido → `InvalidPositionError`) en `backend/src/domain/player/position.spec.ts`
- [X] T012 [P] Unit tests de `Player.restore` (getters exponen exactamente lo que se les pasó) en `backend/src/domain/player/player.spec.ts`

### Persistencia (`repositories/`)

- [X] T013 [P] Crear `PlayerEntity` (`@Entity('players')`: `id` uuid PK, `name`/`team` varchar, `league`/`position` varchar — sin `enum` nativo de Postgres, data-model.md) en `backend/src/repositories/entities/player.entity.ts`
- [X] T014 Crear `PlayerMapper` (`PlayerEntity ↔ Player`, sin lógica de negocio, usa `parseLeague`/`parsePosition` al reconstruir desde la entidad) en `backend/src/repositories/mappers/player.mapper.ts` (depende de T009, T013)
- [X] T015 [P] Crear puerto `PlayerRepository` (interface: `findPage(filters, pagination)`, `findById(id)`) + tipo `PlayerFilters` en `backend/src/repositories/player.repository.ts`
- [X] T016 Implementar `TypeOrmPlayerRepository`: `findPage` combina filtros presentes con AND vía `WHERE` (match exacto insensible a mayúsculas en `team`), pagina con `LIMIT/OFFSET`, `total` con `COUNT` sobre el mismo `WHERE` sin paginar, orden `ORDER BY id ASC`; `findById` devuelve `null` si no existe (incluido id con formato inválido, capturando el 22P02 de Postgres) — en `backend/src/repositories/typeorm-player.repository.ts` (depende de T014, T015)

### Migration de seed (`database/`)

- [X] T017 [P] Crear `DataSource` standalone (sin entidades, sólo `type/url/migrations`) en `backend/src/database/player-catalog-data-source.ts`, **sin tocar** `backend/src/database/database.module.ts` (research.md §2)
- [X] T018 Crear migration `<timestamp>-SeedPlayerCatalog.ts` en `backend/src/database/migrations/` — `up`: `INSERT INTO players (...) VALUES (...) ON CONFLICT (id) DO NOTHING` con los 20 jugadores exactos de [data-model.md § Seed](./data-model.md#seed-los-20-jugadores-una-migration-insert--on-conflict-id-do-nothing) (UUIDs literales fijos generados una vez); `down`: `DELETE` esas 20 filas por id (depende de T017)
- [X] T019 Crear `runPlayerCatalogMigrations()` (inicializa el `DataSource` de T017, llama `.runMigrations()`, lo destruye) en `backend/src/database/run-player-catalog-migrations.ts` (depende de T017)

### `ApiKeyGuard` (US3 — pero es prerequisito bloqueante de US1/US2, research.md §1)

- [X] T020 Implementar `ApiKeyGuard`: lee `request.headers['x-api-key']`, si falta → `UnauthorizedException`; hashea con `TokenHasher` (inyectado vía `TOKEN_HASHER`) y busca con `ApiKeyRepository.findByHash` (inyectado vía `API_KEY_REPOSITORY`); si no existe o `!isActive()` → `UnauthorizedException`; **no** usa `RawApiKey.of()` (research.md §3) — en `backend/src/guards/api-key.guard.ts`
- [X] T021 [P] Unit tests de `ApiKeyGuard` con `TokenHasher`/`ApiKeyRepository` mockeados: sin header, hash sin match, hash de una key revocada (`revokedAt` seteado), hash de una key activa — en `backend/src/guards/api-key.guard.spec.ts` (depende de T020)

### Wiring compartido

- [X] T022 [P] Crear `PLAYER_REPOSITORY = Symbol('PLAYER_REPOSITORY')` en `backend/src/player.constants.ts`
- [X] T023 Crear `PlayerModule` (`imports: [ApiKeyModule, TypeOrmModule.forFeature([PlayerEntity])]`, provider `{ provide: PLAYER_REPOSITORY, useClass: TypeOrmPlayerRepository }`, `PlayerMapper`; controller/service se agregan en US1) en `backend/src/player.module.ts` (depende de T002, T016, T022) — también registra `ApiKeyGuard` como provider, para que `@UseGuards(ApiKeyGuard)` pueda resolverlo por DI
- [X] T024 Importar `PlayerModule` en `backend/src/app.module.ts`
- [X] T025 Agregar rama `PlayerNotFoundError -> 404` en `resolve()` de `backend/src/shared/filters/all-exceptions.filter.ts` (import + `instanceof`, sin tocar el resto del filtro) (depende de T006)
- [X] T026 Invocar `runPlayerCatalogMigrations()` en `backend/src/main.ts` justo después de `NestFactory.create(AppModule)` y antes de `app.listen()`; agregar `addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'ApiKeyAuth')` al `DocumentBuilder` (depende de T019)
- [X] T027 Invocar `runPlayerCatalogMigrations()` dentro de `createTestApp()` en `backend/test/test-app.ts`, justo después de `await app.init()` (depende de T019)

**Checkpoint**: dominio, persistencia, migration y guard listos y testeados. `PlayerModule` importa en `AppModule` sin exponer todavía ningún endpoint. A partir de acá, US1 y US2 pueden implementarse (comparten `PlayerService`/`PlayerController`, se numeran secuencialmente por tocar los mismos archivos).

---

## Phase 3: User Story 1 — Listado paginado y filtrable del catálogo (Priority: P1) 🎯 MVP

**Goal**: `GET /players` filtra por liga/equipo/posición (AND) y pagina, devolviendo el catálogo real de 20 jugadores cargado por la migration.

**Independent Test**: con una ApiKey válida, `GET /players` sin filtros da `total=20` y 10 items (defaults); las 20 combinaciones liga+posición dan `total=1` cada una; un filtro sin match da `200` con `items: []` y `total: 0`.

### Tests for User Story 1 ⚠️

> Escribir estos tests primero y confirmar que fallan antes de implementar (no hay todavía `PlayerService`/`PlayerController`).

- [X] T028 [P] [US1] Unit test `PlayerService.listPlayers` con `PlayerRepository` mockeado: aplica defaults `page=1`/`pageSize=10` cuando no se pasan, delega filtros tal cual al repo, devuelve `{ items, total }` tal cual los da el repo — en `backend/src/services/player.service.spec.ts` (defaults verificados a nivel DTO/e2e — ver T031, T030)
- [X] T029 [P] [US1] Integration test `PlayerService` + `TypeOrmPlayerRepository` contra Postgres real (Testcontainers), con fixtures propios insertados directamente (no depende de la migration de seed): filtros combinados con AND, paginación (`LIMIT/OFFSET` correctos), `total` sin paginar, filtro sin resultados → `{ items: [], total: 0 }` — en `backend/src/services/player.service.integration.spec.ts`
- [X] T030 [P] [US1] E2E test (app completa, migration de seed real corrida por `test-app.ts`): `GET /players` sin filtros (`total=20`, 10 items), las 20 combinaciones liga+posición (`total=1` cada una), filtro sin resultados (`items: []`), paginación `page=2&pageSize=5`, valores fuera de rango (`pageSize=51`, `page=0`, `position=XX` → 400) — en `backend/test/player-catalog.e2e-spec.ts`

### Implementation for User Story 1

- [X] T031 [P] [US1] Crear `ListPlayersQueryDto` (`league`/`team`/`position` como `string` opcional sin `@IsEnum`, `page`/`pageSize` con `@Type(() => Number) @IsInt() @Min(1)` y `@Max(50)` en `pageSize`, defaults `1`/`10` vía field initializer + class-transformer) en `backend/src/controllers/dto/player/list-players-query.dto.ts` (research.md §4)
- [X] T032 [P] [US1] Crear `PlayerResponseDto` (`id`, `name`, `league`, `team`, `position`, `fromDomain(player: Player)`) en `backend/src/controllers/dto/player/player-response.dto.ts`
- [X] T033 [US1] Crear `PlayerListResponseDto` (`items: PlayerResponseDto[]`, `total`, `page`, `pageSize`) en `backend/src/controllers/dto/player/player-list-response.dto.ts` (depende de T032)
- [X] T034 [US1] Implementar `PlayerService.listPlayers(filters, pagination)` (delega a `PlayerRepository.findPage`; los defaults de paginación ya llegan resueltos desde el DTO) en `backend/src/services/player.service.ts` (depende de T016, T028/T029 ya en rojo)
- [X] T035 [US1] Crear `PlayerController` con `GET /players` — `@Controller('players')`, `@Public()` a nivel de clase, `@UseGuards(ApiKeyGuard)`, `@ApiSecurity('ApiKeyAuth')`, `@ApiTags('players')`; parsea query→`PlayerFilters` de dominio con `parseLeague`/`parsePosition` antes de llamar al Service — en `backend/src/controllers/player.controller.ts` (depende de T020, T031, T033, T034)
- [X] T036 [US1] Registrar `PlayerService` y `PlayerController` en `backend/src/player.module.ts` (extiende el módulo creado en T023) (depende de T023, T034, T035)

**Checkpoint**: `GET /players` funcional y testeable de forma independiente (protegido por `ApiKeyGuard` desde el primer commit).

---

## Phase 4: User Story 2 — Detalle de un jugador puntual (Priority: P1)

**Goal**: `GET /players/:id` devuelve el jugador (200) o 404 si el id no existe en el catálogo.

**Independent Test**: tomar un id devuelto por el listado y pedir su detalle (200, mismos datos); pedir un id inexistente (404).

### Tests for User Story 2 ⚠️

- [X] T037 [P] [US2] Unit test `PlayerService.getPlayerById`: repo devuelve `Player` → se devuelve tal cual; repo devuelve `null` → lanza `PlayerNotFoundError` — agregar a `backend/src/services/player.service.spec.ts`
- [X] T038 [US2] Integration test `findById` contra Postgres real (fixture propio insertado + un id que no existe) — agregar a `backend/src/services/player.service.integration.spec.ts` (ya se había escrito junto con T029)
- [X] T039 [US2] E2E test `GET /players/:id`: 200 con un id existente del catálogo de seed (mismos datos que en el listado), 404 con un id bien formado pero inexistente, 404 con un id de formato inválido — agregar a `backend/test/player-catalog.e2e-spec.ts`

### Implementation for User Story 2

- [X] T040 [US2] Implementar `PlayerService.getPlayerById(id)` (lanza `PlayerNotFoundError` si `PlayerRepository.findById` devuelve `null`) en `backend/src/services/player.service.ts` (mismo archivo que T034 — secuencial; ya se había escrito junto con T034)
- [X] T041 [US2] Agregar handler `GET /players/:id` a `PlayerController` (mismos decoradores de auth que la clase ya lleva desde T035; `@ApiResponse` 200/404) en `backend/src/controllers/player.controller.ts` (mismo archivo que T035 — secuencial)

**Checkpoint**: US1 y US2 funcionan juntas; el catálogo completo (listado + detalle) queda operativo.

---

## Phase 5: User Story 3 — Protección de ambos endpoints mediante ApiKey (Priority: P2)

**Goal**: verificar de punta a punta que ningún request sin una ApiKey activa entra a `GET /players` ni a `GET /players/:id`, y que un JWT no alcanza como alternativa.

**Independent Test**: contra ambos endpoints ya construidos: sin header, con ApiKey inexistente/adulterada, con una ApiKey revocada (reemplazada por una emisión posterior), y con sólo un JWT válido — los cuatro casos dan 401 y no exponen datos del catálogo.

> El código de `ApiKeyGuard` ya se implementó y unit-testeó en Foundational (T020, T021) porque US1 y US2 no podían construirse sin él ya protegiéndolas. El aporte de esta fase es la verificación e2e de punta a punta contra los endpoints reales, exigida explícitamente por la spec (User Story 3).

### Tests for User Story 3

- [X] T042 [US3] E2E tests de rechazo contra `GET /players` **y** `GET /players/:id`: (a) sin header `x-api-key` → 401; (b) `x-api-key` inexistente/adulterada → 401; (c) `x-api-key` de una ApiKey revocada (emitir una segunda vía `POST /auth/api-key` para el mismo usuario e intentar con la primera) → 401; (d) sólo `Authorization: Bearer <jwt válido>`, sin `x-api-key` → 401; en todos los casos, el body de la respuesta no contiene datos de jugadores — agregar a `backend/test/player-catalog.e2e-spec.ts`

**Checkpoint**: las 3 user stories quedan cubiertas end-to-end; el catálogo está completo y protegido.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: cerrar la Definición de Terminado (Principio X) más allá de las user stories.

- [X] T043 [P] Actualizar `docs/postman/desapp.postman_collection.json` con `GET /players` y `GET /players/:id` (header `x-api-key`, variable de entorno para la ApiKey)
- [X] T044 Correr la validación manual completa de [quickstart.md](./quickstart.md) (migration, arranque, los 7 escenarios curl, Swagger `/docs` con el candado `ApiKeyAuth`) — corrido contra el servidor dev ya levantado: total=20 sin filtros, las 20 combinaciones liga+posición dan total=1, filtro vacío da 200/[], paginación page=2/pageSize=5 correcta, pageSize=51/position=XX/page=0 dan 400, detalle 200/404 correctos, sin ApiKey y sólo-JWT dan 401, Swagger expone `ApiKeyAuth` en ambos endpoints
- [X] T045 Correr `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e` en `backend/` y confirmar que el test de arquitectura (`tsarch`) sigue en verde sin haberlo tocado — lint y build limpios; 115 tests unit+integración (23 suites) y 53 tests e2e (5 suites), todos en verde

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato.
- **Foundational (Phase 2)**: depende de Setup — **bloquea** a las 3 user stories.
- **User Story 1 (Phase 3)**: depende de Foundational. Es el MVP.
- **User Story 2 (Phase 4)**: depende de Foundational; en la práctica también de que
  US1 ya haya creado `PlayerController`/`PlayerService`/`PlayerModule` (T035, T034,
  T036), porque US2 extiende esos mismos archivos en vez de crear los suyos.
- **User Story 3 (Phase 5)**: depende de Foundational (el guard ya está ahí) y de que
  US1 **y** US2 existan (sus e2e pegan contra los dos endpoints reales).
- **Polish (Phase 6)**: depende de que las 3 user stories estén completas.

### Notas sobre "independencia" de las user stories

A diferencia del caso genérico de la plantilla, acá US1/US2/US3 comparten un único
recurso (`Player`) y un único guard transversal, así que no son paralelizables entre
sí por distintos desarrolladores sin pisarse archivos (`player.controller.ts`,
`player.service.ts` y `player-catalog.e2e-spec.ts` se tocan en más de una fase). Cada
una sigue siendo **independientemente demostrable y testeable** una vez completa
(criterio real de "independent test" de la spec), pero la ejecución recomendada es
secuencial en orden de prioridad: Foundational → US1 → US2 → US3 → Polish.

### Parallel Opportunities

- Todas las tareas `[P]` de Setup (T001-T003) en paralelo.
- Dentro de Foundational: T004-T006 (errores) en paralelo entre sí; T010-T012 (unit
  tests de dominio) en paralelo entre sí una vez existen T007-T009; T013/T015/T017/
  T022 en paralelo entre sí (archivos distintos, sin dependencias cruzadas).
- Dentro de US1: T028/T029/T030 (los 3 tests) en paralelo entre sí; T031/T032 en
  paralelo entre sí.
- T021 (unit test del guard) puede ir en paralelo con cualquier tarea de dominio o
  persistencia de Foundational — no depende de ellas, sólo de T020.

---

## Parallel Example: Foundational — errores de dominio

```bash
Task: "Crear InvalidLeagueError en backend/src/domain/player/errors/invalid-league.error.ts"
Task: "Crear InvalidPositionError en backend/src/domain/player/errors/invalid-position.error.ts"
Task: "Crear PlayerNotFoundError en backend/src/domain/player/errors/player-not-found.error.ts"
```

## Parallel Example: User Story 1 — tests

```bash
Task: "Unit test PlayerService.listPlayers en backend/src/services/player.service.spec.ts"
Task: "Integration test PlayerService+TypeOrmPlayerRepository en backend/src/services/player.service.integration.spec.ts"
Task: "E2E test GET /players en backend/test/player-catalog.e2e-spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational (crítico — incluye el `ApiKeyGuard`, sin el cual
   ningún endpoint puede exponerse sin violar FR-011/FR-012).
3. Completar Phase 3: User Story 1.
4. **Parar y validar**: correr los escenarios 1-5 de quickstart.md contra `GET /players`.
5. Recién ahí seguir con US2.

### Entrega incremental

1. Setup + Foundational → catálogo cargado, guard funcionando, sin endpoints expuestos aún.
2. + US1 → `GET /players` demostrable (MVP).
3. + US2 → `GET /players/:id` demostrable; catálogo completo.
4. + US3 → cobertura e2e explícita de los 4 rechazos sobre ambos endpoints.
5. + Polish → Postman, quickstart y suite completa en verde (Definición de Terminado).

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes entre sí.
- `[Story]` mapea cada tarea a su user story para trazabilidad contra spec.md.
- No modificar `backend/src/database/database.module.ts` en ninguna tarea (research.md §2).
- No agregar variables de entorno nuevas ni tocar `.env.example` (spec, Assumptions).
- Commitear después de cada tarea o grupo lógico; no mezclar tareas de fases distintas en un mismo commit.

---

description: "Task list for Health check del backend"

---

# Tasks: Health check del backend

**Input**: Design documents from `specs/027-health-check/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/health-api.md](./contracts/health-api.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos y obligatorios — el Principio IX de la constitución exige casos felices y casos borde, unit tests y e2e con supertest sobre PostgreSQL efímero de Testcontainers (nunca la base de desarrollo). El test de arquitectura tsarch ya existente (`backend/test/architecture.spec.ts`) cubre las capas nuevas sin cambios.

**Organization**: Tareas agrupadas por user story de `spec.md` (US1–US3 son P1; US4 es P2). Es un único endpoint con una sola implementación: el código de producción nace en US1 (MVP) y las historias US2–US4 agregan los tests, la documentación y las verificaciones que prueban cada requisito por separado. Esas historias no tienen código de producción propio, salvo el Swagger de US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1 (200/503), US2 (detalle por componente), US3 (acceso sin autenticación), US4 (proveedores externos no afectan)
- Rutas exactas en cada descripción, siguiendo la estructura de `plan.md`
- Todo el trabajo es en `backend/`; los comandos `pnpm` se corren desde `backend/`

## Path Conventions

Monorepo existente. Backend NestJS en capas: `backend/src/controllers/`, `backend/src/services/`, `backend/src/modules/`, e2e en `backend/test/`. Esta feature no toca `frontend/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencia nueva

- [X] T001 Agregar `@nestjs/terminus@^11.1.1` con `pnpm add @nestjs/terminus@^11.1.1` ejecutado en `backend/` (actualiza `backend/package.json` y `backend/pnpm-lock.yaml`). Debe ser la línea 11.x: la 12.x es ESM-only y no es importable desde este backend CommonJS (ver `research.md` §1). No usar `npm install`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Forma de la respuesta y retiro del `GET /health` viejo, que choca con el nuevo

**⚠️ CRITICAL**: Ningún test de las historias puede correr hasta retirar el handler viejo (dos `GET /health` simultáneos).

- [X] T002 [P] Crear `backend/src/controllers/observability/dto/health-response.dto.ts` con `HealthResponseDto` y `ComponentStatusDto` según `data-model.md` y `contracts/health-api.md`: `status` (`'ok' | 'error'`), `info`, `error`, `details` como mapas `componente → { status: 'up' | 'down', message?: string }`, con `@ApiProperty` de `@nestjs/swagger`. Identificadores en inglés (Principio XI)
- [X] T003 **PUERTA — requiere un "sí" explícito del usuario antes de ejecutarse (Principio IX: no se modifican ni borran tests existentes sin permiso).** Pedir el permiso y reportar cada borrado. Con el "sí": en `backend/src/app.controller.ts` eliminar el método `getHealth` (y los imports que queden sin uso: `Public` sigue usándose en `getRoot`); en `backend/src/app.service.ts` eliminar `getHealth`; en `backend/src/app.controller.spec.ts` y `backend/src/app.service.spec.ts` eliminar únicamente el bloque `describe('getHealth')` de cada uno (los tests de `getRoot` no se tocan). `backend/test/protected.e2e-spec.ts` NO se modifica: su test "GET / y GET /health siguen respondiendo sin token" sigue siendo válido

**Checkpoint**: Hay un único lugar donde registrar `GET /health`.

---

## Phase 3: User Story 1 - Saber si el sistema puede atender requests (Priority: P1) 🎯 MVP

**Goal**: `GET /health` responde 200 `{status:"ok"}` con la base sana y 503 `{status:"error"}` con la base caída o colgada, y se recupera sin reiniciar.

**Independent Test**: Con la base sana, `GET /health` → 200 y `status: "ok"`; con `query` de la `DataSource` rechazada → 503 y `status: "error"`; al restaurarla, vuelve a 200.

### Tests for User Story 1 ⚠️ (escribirlos primero y verificar que fallan)

- [X] T004 [P] [US1] Crear `backend/src/services/observability/health.service.spec.ts` (unit, `HealthCheckService` y `TypeOrmHealthIndicator` simulados): (a) ping up → devuelve el resultado con `status: 'ok'`; (b) `check()` lanza `ServiceUnavailableException` con resultado `error` → el service **devuelve** ese resultado y no relanza; (c) un error inesperado que no sea `ServiceUnavailableException` se propaga; (d) se invoca `pingCheck('database', { timeout: 3000 })`
- [X] T005 [P] [US1] Crear `backend/src/controllers/observability/health.controller.spec.ts` (unit, `HealthService` simulado): resultado `status: 'ok'` → no fija 503 (queda 200) y devuelve el informe tal cual; resultado `status: 'error'` → `res.status(503)` y devuelve el informe
- [X] T006 [US1] Crear `backend/test/observability/health.e2e-spec.ts` (usa `createTestApp()` de `backend/test/test-app.ts`, patrón de `backend/test/protected.e2e-spec.ts`) con los casos de US1: (a) `GET /health` → 200, `body.status === 'ok'`; (b) tras `jest.spyOn(ctx.dataSource, 'query').mockRejectedValue(new Error('boom'))` → 503 y `body.status === 'error'`; (c) tras `mockRestore()` → 200 otra vez, sin reiniciar la app (FR-010 / SC-003); (d) `query` que nunca resuelve (`new Promise(() => {})`) → 503 en menos de 5 s (FR-009 / SC-004, subir el timeout de Jest a 15 s en ese test). Restaurar siempre el spy en `afterEach`

### Implementation for User Story 1

- [X] T007 [US1] Crear `backend/src/services/observability/health.service.ts`: `HealthService` con `HealthCheckService` y `TypeOrmHealthIndicator` inyectados; método `check()` que llama `health.check([() => typeOrm.pingCheck('database', { timeout: 3000 })])`, atrapa `ServiceUnavailableException` y devuelve `exception.getResponse()` como `HealthResponseDto`; cualquier otra excepción se relanza (`research.md` §2). Sin caché (FR-010)
- [X] T008 [US1] Crear `backend/src/controllers/observability/health.controller.ts`: `@Controller('health')`, `@Public()` de `backend/src/guards/public.decorator.ts`, `@Get()` que llama a `HealthService.check()`, usa `@Res({ passthrough: true })` y fija `res.status(503)` si `status !== 'ok'`. El controller solo habla con el Service (Principio I)
- [X] T009 [US1] Crear `backend/src/modules/observability/health.module.ts` (importa `TerminusModule`, declara `HealthController` y `HealthService`) y registrar `HealthModule` en el array `imports` de `backend/src/app.module.ts`
- [X] T010 [US1] Correr `pnpm test:unit` y `pnpm test:e2e -- health.e2e-spec` desde `backend/`: T004–T006 pasan, `backend/test/architecture.spec.ts` sigue en verde y `backend/test/protected.e2e-spec.ts` también

**Checkpoint**: US1 funcional: el health check ya sirve para decidir si el sistema está sano (MVP).

---

## Phase 4: User Story 2 - Distinguir qué componente está fallando (Priority: P1)

**Goal**: El cuerpo informa el estado individual de cada dependencia verificada, sin filtrar información sensible, y la API lo documenta.

**Independent Test**: Con la base sana el cuerpo trae `details.database.status === 'up'`; con la base caída, `error.database.status === 'down'` y el texto del error original no aparece en el cuerpo.

### Tests for User Story 2 ⚠️

- [X] T011 [US2] Agregar a `backend/test/observability/health.e2e-spec.ts` los casos de US2: (a) 200 → `details.database.status === 'up'` e `info.database.status === 'up'`; (b) 503 con `query` rechazada → `error.database.status === 'down'` y `details.database.status === 'down'`; (c) FR-008: rechazar con `new Error('postgres://user:secret@db:5432/app')` y verificar que el body serializado (`JSON.stringify(res.body)`) no contiene `secret`, `postgres://` ni `boom`, ni `stack`; (d) en el caso de timeout, `message` es exactamente `timeout of 3000ms exceeded`; (e) `Object.keys(res.body.details)` es exactamente `['database']`

### Implementation for User Story 2

- [X] T012 [US2] En `backend/src/controllers/observability/health.controller.ts` agregar la documentación Swagger (Principio VIII): `@ApiTags('health')`, `@ApiOperation` (resumen en español), `@ApiResponse({ status: 200, type: HealthResponseDto })` y `@ApiResponse({ status: 503, type: HealthResponseDto })`. No usar `@HealthCheck()` de Terminus (`research.md` §7)

**Checkpoint**: US1 + US2: el detalle por componente está probado y documentado.

---

## Phase 5: User Story 3 - Consultar la salud sin autenticarse (Priority: P1)

**Goal**: El endpoint de salud es público; el resto de la API sigue protegida.

**Independent Test**: `GET /health` sin `Authorization` devuelve 200 (sano) o 503 (base caída), nunca 401; `GET /auth/me` sin token sigue dando 401.

### Tests for User Story 3 ⚠️

- [X] T013 [US3] Agregar a `backend/test/observability/health.e2e-spec.ts` los casos de US3 (sin ningún header `Authorization`): (a) base sana → 200, no 401; (b) base caída (`query` rechazada) → 503, no 401; (c) en la misma app, `GET /auth/me` sin token → 401, probando que la exención se limita al health check (FR-007)

### Implementation for User Story 3

- [X] T014 [US3] Verificar que `@Public()` quedó aplicado en `backend/src/controllers/observability/health.controller.ts` (ya incluido en T008; no hay código nuevo) y que T013 pasa. Si T013 falla con 401, corregir el decorator en el controller

**Checkpoint**: US1–US3: acceso público probado.

---

## Phase 6: User Story 4 - Una caída de los proveedores externos no marca al sistema como no disponible (Priority: P2)

**Goal**: Football-Data y WhoScored no participan del chequeo: ni se invocan ni alteran el resultado.

**Independent Test**: Con los adaptadores externos reemplazados por dobles que fallan, `GET /health` devuelve 200 `ok` y los dobles no fueron invocados.

### Tests for User Story 4 ⚠️

- [X] T015 [US4] Agregar a `backend/test/observability/health.e2e-spec.ts` un `describe` separado de US4 que levanta la app con `createTestApp([...])` sobreescribiendo `WHOSCORED_ADAPTER` (de `backend/src/modules/player-sync/player-sync.constants.ts`) y `FOOTBALL_DATA_ADAPTER` (de `backend/src/modules/competition/football-data-sync.constants.ts`) con objetos cuyos métodos son `jest.fn().mockRejectedValue(new Error('proveedor caído'))` (mismo patrón que `backend/test/sync-trigger.e2e-spec.ts`). Verificar: (a) `GET /health` → 200 y `status: 'ok'`; (b) ningún `jest.fn` del adaptador fue invocado; (c) `details` no incluye `footballData` ni `whoscored`

### Implementation for User Story 4

- [X] T016 [US4] Sin código de producción nuevo: el indicador de base de datos del `HealthService` (T007) es el único configurado. Verificar que T015 pasa; si falla, quitar de `HealthService` cualquier indicador distinto de `database`

**Checkpoint**: Las cuatro historias probadas.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Definición de terminado (Principio X) y validación final

- [X] T017 [P] Actualizar `docs/postman/desapp.postman_collection.json`, request «Root y Health — públicos, sin token (200)»: agregar aserciones `pm.expect(pm.response.json().status).to.eql('ok')` y `pm.expect(pm.response.json().details.database.status).to.eql('up')`, y ampliar la `description` para mencionar el 503 con `status: "error"` cuando la base no responde (no reproducible desde la colección). Mantener JSON válido y el formato de indentación del archivo
- [X] T018 [P] Ejecutar `pnpm lint` en `backend/` y corregir lo que falle en los archivos nuevos o editados
- [X] T019 Ejecutar `pnpm build` (`nest build`) en `backend/` sin errores
- [X] T020 Ejecutar la suite completa desde `backend/`: `pnpm test:unit`, `pnpm test:integration` y `pnpm test:e2e`. Todo en verde; los e2e deben usar la base efímera de Testcontainers (si caen a la base de desarrollo, dejarlo reportado como indica la memoria del proyecto)
- [X] T021 Recorrer `specs/027-health-check/quickstart.md` en la base local: base sana → 200; `docker compose stop` → 503 en ≤ ~3 s; `docker compose start` → 200 sin reiniciar el backend; el body no contiene datos sensibles; abrir `/docs` y confirmar el endpoint bajo la etiqueta `health` con respuestas 200 y 503 **(hecho 2026-11-10 contra una base desechable: ver nota en el informe de cierre)**
- [X] T022 Confirmar que el frontend sigue levantando: su `frontend/test/setup/global-setup.ts` espera `res.ok` en `/health`; correr una vez la suite de frontend que usa backend real (`pnpm test` en `frontend/`) o, si no es viable, dejar anotado por qué no se corrió. No modificar archivos del frontend

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001 solo para T002 (usa `@nestjs/swagger`, ya presente: en la práctica es paralelo). **T003 (retiro del handler viejo) bloquea todos los e2e** y exige el "sí" del usuario.
- **US1 (Phase 3)**: depende de Phase 2. Es el MVP.
- **US2 (Phase 4), US3 (Phase 5), US4 (Phase 6)**: dependen de US1 (reutilizan el endpoint y el archivo `health.e2e-spec.ts`). Entre sí son independientes en lógica, pero comparten el archivo `backend/test/observability/health.e2e-spec.ts` y `health.controller.ts` (T012), así que sus ediciones se hacen en secuencia, no en paralelo.
- **Polish (Phase 7)**: depende de todas las historias que se incluyan.

### Within Each User Story

- Tests primero (verlos fallar) → service → controller → módulo → correr.
- T007 (service) antes de T008 (controller) antes de T009 (módulo).

### Parallel Opportunities

- Phase 2: T002 en paralelo con la gestión de T003.
- US1: T004 y T005 (archivos distintos) en paralelo; T006 puede escribirse al mismo tiempo.
- Polish: T017 y T018 en paralelo.

---

## Parallel Example: User Story 1

```text
# Tests de US1 a la vez (archivos distintos):
T004  backend/src/services/observability/health.service.spec.ts
T005  backend/src/controllers/observability/health.controller.spec.ts
T006  backend/test/observability/health.e2e-spec.ts   (otro archivo, sin dependencia de T004/T005)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001 (dependencia) → T002 (DTO) → T003 (puerta + retiro del handler viejo).
2. Tests de US1 (T004–T006), luego T007–T009, luego T010.
3. **PARAR y VALIDAR**: `GET /health` real responde 200/503. Ya es desplegable.

### Incremental Delivery

1. US1 → MVP.
2. US2 (detalle probado + Swagger) → US3 (público probado) → US4 (proveedores externos probados).
3. Polish: Postman, lint, build, suite completa, quickstart manual, frontend.

---

## Notes

- Sin migraciones, sin variables de entorno nuevas, sin cambios de frontend.
- El filtro global `AllExceptionsFilter` **no se modifica** (`research.md` §2).
- No hacer `git commit`: los cambios quedan sin commitear para que los revise el usuario.
- Los únicos tests existentes que se tocan son los dos bloques `describe('getHealth')` de T003, bajo la puerta de permiso explícito.

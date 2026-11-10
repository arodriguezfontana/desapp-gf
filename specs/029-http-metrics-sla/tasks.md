---

description: "Task list for Métricas técnicas (latencia y tasa de error) y SLA por endpoint"

---

# Tasks: Métricas técnicas (latencia y tasa de error) y SLA por endpoint

**Input**: Design documents from `specs/029-http-metrics-sla/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/metrics-api.md](./contracts/metrics-api.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos y obligatorios — el Principio IX de la constitución exige casos felices y borde, unit tests y e2e con supertest sobre PostgreSQL efímero de Testcontainers. El test de arquitectura tsarch existente (`backend/test/architecture.spec.ts`) cubre las capas sin cambios. **Ningún test existente se modifica ni se borra**: las ampliaciones van en archivos nuevos (por eso el hook se prueba en `request-metrics-hook.spec.ts` y no en `request-log-options.spec.ts`).

**Organization**: Tareas agrupadas por user story de `spec.md` (US1–US4 son P1; US5 es P2). La lógica pura (etiquetas, buckets, recorder) y el servicio de métricas bloquean a todas las historias y están en Foundational. US1 expone `GET /metrics`; US2 conecta la captura al hook de la 028 (sin esto las familias salen vacías, por eso **el MVP real es US1 + US2**); US3 y US4 verifican cardinalidad y tasa de error honesta sobre esa misma captura; US5 agrega el SLA verificable.

**⚠️ Antes de cualquier tarea que corra e2e o integración** (T015, T020, T022, T024, T045, T049): ejecutar `docker info`. Si Docker está apagado, el setup de tests cae en silencio a la base de desarrollo y los e2e **borran datos** (ya pasó). Si está apagado, levantar Docker Desktop y esperar a que `docker info` responda antes de correr nada.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1 (consultar `/metrics` sin credenciales), US2 (medir toda request, incluidas las rechazadas), US3 (cardinalidad acotada), US4 (tasa de error 5xx separada de 4xx), US5 (SLA declarado y verificable)
- Rutas exactas en cada descripción, siguiendo la estructura de `plan.md`
- Todo el trabajo es en `backend/` (más `docs/postman/`); los comandos `pnpm` se corren desde `backend/`. No se hace `git commit` (el usuario commitea)

## Path Conventions

Monorepo existente. Backend NestJS por capas: `backend/src/controllers/<feature>`, `backend/src/services/<feature>`, `backend/src/modules/<feature>`, `backend/src/shared/<tema>` (lógica pura sin Nest), `backend/test/` (e2e + helpers). Esta feature no toca `frontend/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencia nueva y línea base

- [X] T001 Agregar la dependencia con pnpm desde `backend/`: `pnpm add prom-client@^15.1.3` (actualiza `backend/package.json` y `backend/pnpm-lock.yaml`). No usar `npm`. Sin variables de entorno ni migraciones nuevas
- [X] T002 Verificar la línea base antes de tocar código: `pnpm test:unit` y `pnpm build` en verde desde `backend/`, y confirmar que el hook de la 028 existe (`customSuccessObject` y `customErrorObject` en `backend/src/shared/logging/request-log-options.ts`, `configureRequestLogging` en `backend/src/shared/logging/configure-request-logging.ts`). Si algo ya falla, anotarlo para no confundirlo con regresiones de esta feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lógica pura de etiquetas, `Registry` propio con las dos métricas y helper de lectura del formato de texto. Bloquea todas las historias

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase

- [X] T003 [P] Crear el helper de tests `backend/test/helpers/prom-text.ts` que parsea el texto de Prometheus (`parsePrometheusText(text)`) a una lista de muestras `{ name, labels: Record<string,string>, value }`, más utilidades `sampleValue(samples, name, labels)` (devuelve `number | undefined`, coincidencia exacta de etiquetas), `seriesCount(samples, name)` y `familyNames(text)` (los nombres de las líneas `# TYPE`). Sin dependencias nuevas; lo usan los e2e de US1–US5
- [X] T004 [P] Escribir primero `backend/src/shared/metrics/request-metrics.spec.ts` (debe fallar hasta T006) con: `normalizeMethod` (los 7 métodos estándar `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`; minúsculas se pasan a mayúsculas; método inventado, cadena vacía y `undefined` → `OTHER`); `resolveRouteLabel` (`req.route.path` string sin comodín → el patrón; `undefined`, sin `route`, `*`, `/{*splat}` y no-string → `unmatched`; nunca devuelve `req.url`/`req.originalUrl`); `isStreamResponse` (`content-type` que empieza con `text/event-stream`, también con `; charset`, → `true`; `application/json` o ausente → `false`); `toMetricSample(req, res, responseTimeMs)` (método normalizado, ruta resuelta, `statusCode` como número, `durationSeconds = ms / 1000`, y `durationSeconds = null` si es stream); `DURATION_BUCKETS_SECONDS` estrictamente ascendente y exactamente `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 0.6, 0.8, 1, 2.5, 5, 10]`
- [X] T005 [P] Escribir primero `backend/src/services/metrics/metrics.service.spec.ts` (debe fallar hasta T008) con: dos instancias de `MetricsService` en el mismo proceso no lanzan `A metric with the name … has already been registered` (registro aislado por instancia); `record({ method:'GET', route:'/players/:id', statusCode:200, durationSeconds:0.12 })` incrementa `http_requests_total` y observa `http_request_duration_seconds` con etiquetas `method`, `route`, `status_code` (texto); `durationSeconds: null` incrementa el contador y NO el histograma; `render()` devuelve texto con **exactamente** las dos familias (`# TYPE http_request_duration_seconds histogram` y `# TYPE http_requests_total counter`, ninguna otra, sin métricas del proceso); el histograma expone un `le` por cada valor de `DURATION_BUCKETS_SECONDS`; `contentType` empieza con `text/plain; version=0.0.4`
- [X] T006 Crear `backend/src/shared/metrics/request-metrics.ts` (depende de T004) exportando: `UNMATCHED_ROUTE = 'unmatched'`, `OTHER_METHOD = 'OTHER'`, `DURATION_BUCKETS_SECONDS`, `RequestMetricSample` (`{ method: string; route: string; statusCode: number; durationSeconds: number | null }`), la interfaz `RequestMetricsRecorder` (`record(sample: RequestMetricSample): void`) y las funciones puras `normalizeMethod`, `resolveRouteLabel`, `isStreamResponse` y `toMetricSample` descritas en T004. Sin imports de Nest ni de `prom-client` (la capa `shared` queda libre de infraestructura); comentarios en español
- [X] T007 [P] Crear `backend/src/modules/metrics/metrics.constants.ts` con el token de inyección `REQUEST_METRICS_RECORDER` (`Symbol` o string único, igual criterio que `LOG_ROOT_LOGGER` en `backend/src/modules/logging/logging.constants.ts`)
- [X] T008 Crear `backend/src/services/metrics/metrics.service.ts` (depende de T005, T006): `@Injectable()` que implementa `RequestMetricsRecorder`; crea su propio `new Registry()` de `prom-client` (NO el `register` global ni `collectDefaultMetrics`), registra ahí un `Histogram` `http_request_duration_seconds` (ayuda en español, `labelNames: ['method','route','status_code']`, `buckets: DURATION_BUCKETS_SECONDS`) y un `Counter` `http_requests_total` con las mismas etiquetas; `record(sample)` incrementa el contador siempre y observa el histograma sólo si `durationSeconds !== null`; `render(): Promise<string>` (`registry.metrics()`) y `contentType` (`registry.contentType`)

**Checkpoint**: Los unit tests de T004 y T005 pasan (`pnpm test:unit -- request-metrics metrics.service`); la base está lista

---

## Phase 3: User Story 1 - Consultar las métricas sin credenciales (Priority: P1) 🎯 MVP

**Goal**: `GET /metrics` público, en formato de texto de Prometheus, con sólo las dos familias definidas y sin datos de usuarios

**Independent Test**: Consultar `GET /metrics` sin `Authorization` → 200 `text/plain; version=0.0.4`, con las dos familias y sin 401; otro endpoint protegido sigue respondiendo 401 sin token

### Tests for User Story 1 ⚠️

> Escribirlos primero y verificar que fallan antes de implementar

- [X] T009 [P] [US1] Crear `backend/src/controllers/metrics/metrics.controller.spec.ts`: el controller delega todo en `MetricsService` (mock), responde el texto de `render()` y fija el `Content-Type` con `contentType` del servicio; no contiene lógica propia
- [X] T010 [US1] Crear `backend/test/metrics.e2e-spec.ts` (sobre `createTestApp()` de `backend/test/test-app.ts`, **sin sobrescribir `LOG_CONFIG`**, para que el logger quede en `silent` y se pruebe que la medición no depende del nivel de log) con el `describe` de US1: `GET /metrics` sin credenciales → 200 (nunca 401) y `Content-Type` `text/plain; version=0.0.4`; el cuerpo declara exactamente las familias `http_request_duration_seconds` y `http_requests_total` (usar `familyNames` de T003); una request sin token a un endpoint protegido (ej. `GET /auth/me`) sigue dando 401; el cuerpo no contiene ningún token, username, email ni id de usuario usados en el test (FR-012). Los siguientes `describe` de US2–US4 se agregan a este mismo archivo

### Implementation for User Story 1

- [X] T011 [US1] Crear `backend/src/controllers/metrics/metrics.controller.ts` (depende de T008, T009): `@Controller('metrics')`, `@ApiTags('metrics')`, `GET` con `@Public()` (el mismo decorator que usa `backend/src/controllers/health/health.controller.ts`), `@ApiOperation` (español), `@ApiProduces('text/plain')` y `@ApiResponse({ status: 200 })`; devuelve `await metricsService.render()` usando `@Res({ passthrough: true })` para fijar `Content-Type` con `metricsService.contentType`. Sin DTO. El `@Sla('technical')` se agrega en T044
- [X] T012 [US1] Crear `backend/src/modules/metrics/metrics.module.ts` (depende de T007, T008, T011): declara `MetricsController`, provee `MetricsService` y el token `REQUEST_METRICS_RECORDER` con `useExisting: MetricsService`, y exporta ambos (el hook de la 028 lo resuelve con `app.get` en T019)
- [X] T013 [US1] Registrar `MetricsModule` en `imports` de `backend/src/app.module.ts` (depende de T012)
- [X] T014 [US1] Agregar a `docs/postman/desapp.postman_collection.json` la request «Métricas — públicas, sin token (200)» (`GET {{baseUrl}}/metrics`, sin `Authorization`) con tests de Postman: status 200, `Content-Type` incluye `text/plain` y el cuerpo contiene `http_request_duration_seconds` y `http_requests_total`. Seguir el formato de la request de `/health` ya presente (Principio X)
- [X] T015 [US1] Verificar US1: `docker info` primero; luego desde `backend/` `pnpm test:unit -- metrics.controller` y `pnpm test:e2e -- metrics.e2e-spec`. Confirmar en la salida que el e2e corrió sobre Testcontainers (no sobre la base de desarrollo)

**Checkpoint**: `/metrics` responde sin token con las dos familias (todavía sin series: la captura llega en US2)

---

## Phase 4: User Story 2 - Medir toda request, incluidas las rechazadas (Priority: P1)

**Goal**: Cada request, aun la rechazada por guard (401/403), la 404, la 400 por JSON ilegible y la 5xx, se cuenta y mide una sola vez, en el mismo hook de finalización que ya usa el log de requests de la 028

**Independent Test**: Una request 200, una 401 (sin token), una 404, una 400 (JSON malformado) y un 5xx forzado → cada una suma al contador y al histograma con su código real, y el total coincide con las líneas `request completed` del log

### Tests for User Story 2 ⚠️

- [X] T016 [P] [US2] Crear `backend/src/shared/logging/request-metrics-hook.spec.ts` (archivo **nuevo**; no se toca `request-log-options.spec.ts`) probando `buildRequestLogOptions(logger, recorder)`: `customSuccessObject` y `customErrorObject` llaman a `recorder.record` una vez con los mismos valores del log (`val.responseTime`, `res.statusCode`, `req.route?.path` con fallback `unmatched`); un recorder que lanza una excepción NO rompe el objeto de log devuelto ni propaga el error (FR-013); sin recorder (parámetro omitido) todo sigue funcionando; `customLogLevel` nunca devuelve `silent` para 200, 401, 404, 500 ni sin `res` (si lo hiciera, `pino-http` omitiría los callbacks y esa ruta dejaría de medirse)
- [X] T017 [US2] Ampliar `backend/test/metrics.e2e-spec.ts` con el `describe` de US2: tras tráfico real, `GET /metrics` contiene series para `GET /health` 200, `GET /auth/me` 401 **con su patrón** `route="/auth/me"`, una ruta inexistente → `route="unmatched",status_code="404"`, **un `POST /auth/login` con `Content-Type: application/json` y cuerpo `{"a":` (JSON malformado) → `method="POST",route="unmatched",status_code="400"`** (ambos casos, 404 y 400, quedan contabilizados bajo `unmatched` y no se pierden), y un 5xx forzado (mismo espía `jest.spyOn(ctx.app.get(UserRepository), 'findById')` que usa `backend/test/request-logging.e2e-spec.ts`) → `status_code="500"`; el contador y `_count` del histograma suben en uno por request; la medición funciona con el logger en `silent`. Agregar un caso aparte (segunda app o `describe` con `LOG_CONFIG` capturado vía `backend/test/helpers/log-capture.ts`) que compruebe FR-005: la suma de `http_requests_total` de la ventana == cantidad de entradas `request completed` del log, y la duración observada coincide con la del log. Casos borde: `OPTIONS` de CORS cuenta con `method="OPTIONS"` bajo `unmatched`

### Implementation for User Story 2

- [X] T018 [US2] Editar `backend/src/shared/logging/request-log-options.ts` (depende de T006, T016): `buildRequestLogOptions(logger, recorder?: RequestMetricsRecorder)` con el segundo parámetro **opcional** (para no romper `request-log-options.spec.ts`); en `customSuccessObject` y en `customErrorObject` llamar a `recorder?.record(toMetricSample(req, res, val.responseTime))` dentro de un `try/catch` que ignora el fallo (FR-013), antes de devolver el objeto de log, sin alterar lo que ya devuelven. Agregar un comentario en español junto a `customLogLevel`: las métricas viven dentro de estos callbacks, por lo que ese nivel nunca debe devolver `silent`
- [X] T019 [US2] Editar `backend/src/shared/logging/configure-request-logging.ts` (depende de T018, T012): obtener el recorder con `app.get<RequestMetricsRecorder>(REQUEST_METRICS_RECORDER)` y pasarlo a `buildRequestLogOptions(logger, recorder)`. `backend/src/main.ts` y `backend/test/test-app.ts` ya llaman a `configureRequestLogging`, así que no necesitan cambios; si algún test existente construye la app sin `MetricsModule`, **no modificarlo**: dejar el `app.get` tolerante (`{ strict: false }` y recorder `undefined` si el token no existe) y avisarlo en el reporte
- [X] T020 [US2] Verificar US2: `docker info` primero; luego `pnpm test:unit -- request-metrics-hook request-log-options` y `pnpm test:e2e -- metrics.e2e-spec request-logging.e2e-spec` (el segundo confirma que la 028 no se rompió)

**Checkpoint**: US1 + US2 funcionan juntas: es el MVP medible (métricas reales con 401/404/400/5xx contabilizados)

---

## Phase 5: User Story 3 - Cardinalidad de etiquetas acotada (Priority: P1)

**Goal**: El número de series no crece por URLs arbitrarias, ids variables ni query strings

**Independent Test**: 50 URLs inexistentes distintas y un mismo endpoint con ids distintos no agregan series nuevas más allá de las esperadas

> La implementación de las reglas (patrón de ruta, `unmatched`, método acotado) ya está en T006; esta fase las **verifica de punta a punta**.

- [X] T021 [US3] Ampliar `backend/test/metrics.e2e-spec.ts` con el `describe` de US3: (a) `GET /players/<uuid-1>/quotes` y `GET /players/<uuid-2>/quotes` con un usuario autenticado → una sola serie `route="/players/:id/quotes"`; (b) 50 `GET /x-<n>` inexistentes distintos → la cantidad de series `route="unmatched",status_code="404"` no cambia entre la request 1 y la 50 (usar `seriesCount` de T003) y ninguna etiqueta contiene `/x-`; (c) una request con `?foo=bar&token=abc` no deja la query en ninguna etiqueta; (d) recorrer **todas** las muestras de `/metrics` y afirmar que cada valor de `route` es un patrón conocido o `unmatched`, y cada `method` está en el conjunto cerrado de 8 valores; (e) ningún valor de etiqueta contiene un uuid ni el texto del token del test (SC-003, SC-008)
- [X] T022 [US3] Verificar US3: `docker info` primero; luego `pnpm test:e2e -- metrics.e2e-spec`

**Checkpoint**: La cardinalidad está acotada y probada

---

## Phase 6: User Story 4 - Una tasa de error honesta: 5xx separados de 4xx (Priority: P1)

**Goal**: La tasa de error se calcula sólo sobre 5xx; los 4xx se consultan aparte por código; el stream cuenta pero no distorsiona la latencia

**Independent Test**: Sobre un mismo endpoint, 200, 4xx y 5xx conocidos → 5xx/total da el valor esperado y los 4xx se leen por código; el stream suma al contador y no al histograma

- [X] T023 [US4] Ampliar `backend/test/metrics.e2e-spec.ts` con el `describe` de US4: (a) sobre `GET /auth/me` generar 9 respuestas 200 (token válido), 2 respuestas 4xx (401 sin token y 401 con token inválido) y 1 respuesta 500 forzada con el espía de T017; calcular desde `/metrics` `5xx / total` del endpoint y afirmar que es 1/12 (no 3/12), y que los 4xx se leen por separado como `status_code="401"`; (b) un 503 del health check por base de datos caída cuenta como 5xx de `GET /health` (reusar la técnica de `backend/test/health.e2e-spec.ts` para simular la caída); (c) abrir y cortar `GET /notifications/stream?token=<jwt>` → aparece en `http_requests_total{route="/notifications/stream"}` y **no** suma a `http_request_duration_seconds_count` de esa ruta (FR-011); (d) `http_request_duration_seconds_count` == `http_requests_total` para toda serie que no sea la del stream
- [X] T024 [US4] Verificar US4: `docker info` primero; luego `pnpm test:e2e -- metrics.e2e-spec`

**Checkpoint**: Las historias 1 a 4 funcionan; las métricas son completas y honestas

---

## Phase 7: User Story 5 - SLA declarado y verificable por endpoint (Priority: P2)

**Goal**: Cada handler declara su SLA con `@Sla('<clase>')`, las clases (p95 + tasa 5xx) viven en un solo archivo y un e2e falla si un endpoint publicado no tiene SLA (o al revés), si el identificador no coincide con la etiqueta de las métricas o si un umbral no es un límite del histograma

**Independent Test**: `pnpm test:e2e -- sla-coverage` pasa con los 34 endpoints (33 de controller + `GET /metrics`) y falla si se quita un `@Sla` o se agrega una ruta sin él

### Tests for User Story 5 ⚠️

- [X] T025 [P] [US5] Escribir primero `backend/src/shared/metrics/sla.spec.ts` (falla hasta T026): `@Sla('read')` guarda la clase en metadatos del handler y `getSlaClass(handler)` la devuelve (y `undefined` sin decorator); `SLA_CLASSES` define exactamente `auth, read, read-computed, write, market, system-trigger, system-status, system-long, stream, ping, technical` con los valores de [data-model.md](./data-model.md) (p95: 600/300/800/500/800/1000/300/—/—/100/250 ms; error 5xx máx.: 0,5 % o 1 % en `system-trigger`, `system-status`, `system-long`); toda clase tiene `maxErrorRate`; `p95Ms` es `null` sólo en `system-long` y `stream`; todo umbral `p95Ms / 1000` está incluido en `DURATION_BUCKETS_SECONDS` (FR-016)
- [X] T026 [US5] Crear `backend/src/shared/metrics/sla.ts` (depende de T025, T006): `SlaClassName`, `SLA_CLASSES: Record<SlaClassName, { p95Ms: number | null; maxErrorRate: number }>`, la clave de metadatos `SLA_METADATA_KEY`, el decorator `Sla(name)` (`SetMetadata`) y `getSlaClass(handler)`; comentario de cabecera en español que apunte a la tabla de la spec como referencia legible y a este archivo como fuente verificable
- [X] T027 [P] [US5] Crear el helper `backend/test/helpers/route-inventory.ts` con: `listRouterRoutes(app)` (recorre `app.getHttpAdapter().getInstance().router.stack`, toma las capas con `route`, devuelve `"MÉTODO /patrón"` y **excluye** las rutas comodín `{/*splat}`/`*`), `listDeclaredSla(app)` (recorre `ModulesContainer`, por cada controller lee `PATH_METADATA`/`METHOD_METADATA` de `@nestjs/common/constants`, compone `"MÉTODO /patrón"` normalizando barras y lee `getSlaClass` de cada handler), y `compareRouteSets(published, declared)` que devuelve `{ missingSla: string[], orphanSla: string[] }` (para que el e2e pueda probar que detecta discrepancias)
- [X] T028 [US5] Crear `backend/test/sla-coverage.e2e-spec.ts` (usa `createTestApp()` y T027; depende de T026): (a) `compareRouteSets(listRouterRoutes(app), listDeclaredSla(app))` → ambas listas vacías (cada endpoint publicado tiene SLA y cada SLA corresponde a un endpoint; hoy 34: 33 de controller + `GET /metrics`) (FR-017, SC-005); (b) el identificador `"MÉTODO /patrón"` de cada SLA es el mismo texto que producen las etiquetas `method` y `route` (comparar contra `req.route.path` del router) (FR-015); (c) todo umbral de `SLA_CLASSES` está en `DURATION_BUCKETS_SECONDS` y aparece como `le` en la salida real de `GET /metrics` (FR-016, SC-006); (d) `GET /metrics`, `GET /health` y `GET /` tienen SLA; (e) **meta-test**: `compareRouteSets` con un conjunto sintético al que se le quita una entrada reporta `missingSla`, y con una entrada de más reporta `orphanSla` (comprueba que la verificación realmente falla ante una discrepancia)

### Implementation for User Story 5 (un `@Sla` por handler; archivos distintos, todos en paralelo)

> En cada tarea: importar `Sla` desde `shared/metrics/sla`, poner `@Sla('<clase>')` sobre cada handler indicado y no tocar nada más. Sólo agrega metadatos: no cambia el comportamiento ni los tests existentes de ese controller.

- [X] T029 [P] [US5] `backend/src/controllers/alerts/alerts.controller.ts`: `POST /alerts` → `write`, `GET /alerts` → `read`, `DELETE /alerts/:id` → `write`
- [X] T030 [P] [US5] `backend/src/controllers/api-key/api-key.controller.ts`: `POST /auth/api-key` → `auth`
- [X] T031 [P] [US5] `backend/src/controllers/auth/auth.controller.ts`: `POST /auth/register` → `auth`, `POST /auth/login` → `auth`, `GET /auth/me` → `read`
- [X] T032 [P] [US5] `backend/src/controllers/competition/football-data-sync.controller.ts`: `POST /sync/football-data` → `system-trigger`
- [X] T033 [P] [US5] `backend/src/controllers/health/health.controller.ts`: `GET /health` → `technical`
- [X] T034 [P] [US5] `backend/src/controllers/notifications/notifications-sse.controller.ts`: `GET /notifications/stream` (el handler `@Sse`) → `stream`
- [X] T035 [P] [US5] `backend/src/controllers/notifications/notifications.controller.ts`: `GET /notifications` → `read`, `PATCH /notifications/:id/read` → `write`, `PATCH /notifications/read-all` → `write`
- [X] T036 [P] [US5] `backend/src/controllers/orders/orders.controller.ts`: `POST /orders` → `market`, `DELETE /orders/:id` → `market`, `GET /orders` → `read`, `GET /orders/history` → `read`
- [X] T037 [P] [US5] `backend/src/controllers/player/player.controller.ts`: `GET /players` → `read`, `GET /players/ranking` → `read-computed`, `GET /players/:id` → `read`, `GET /players/:id/valuation` → `read-computed`, `GET /players/:id/quotes` → `read`, `GET /players/:id/order-book` → `read`
- [X] T038 [P] [US5] `backend/src/controllers/player-sync/player-sync.controller.ts`: `POST /sync/whoscored` → `system-trigger`, `GET /sync/whoscored/:runId` → `system-status`
- [X] T039 [P] [US5] `backend/src/controllers/portfolio/portfolio.controller.ts`: `GET /users/:id/portfolio` → `read`
- [X] T040 [P] [US5] `backend/src/controllers/quotation/quotation.controller.ts`: `POST /quotes/recalculate` → `system-long`
- [X] T041 [P] [US5] `backend/src/controllers/simulation/simulation.controller.ts`: `POST /admin/simulate-market` → `system-long`
- [X] T042 [P] [US5] `backend/src/controllers/user-strategy/user-strategy.controller.ts`: `GET /users/me/strategies` → `read`; `PATCH …/:id/select`, `PATCH …/:id/weights` y `PATCH …/:id/position-weights/:position` → `write`
- [X] T043 [P] [US5] `backend/src/app.controller.ts`: `GET /` → `ping`
- [X] T044 [US5] `backend/src/controllers/metrics/metrics.controller.ts` (creado en T011): agregar `@Sla('technical')` a `GET /metrics`
- [X] T045 [US5] Verificar US5: `docker info` primero; luego `pnpm test:unit -- sla` y `pnpm test:e2e -- sla-coverage`. Si (a) reporta rutas sin SLA o SLA huérfanos, corregir el `@Sla` faltante (no relajar el test)

**Checkpoint**: Las cinco historias funcionan y el SLA queda verificado contra el router real

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cierre según la definición de terminado (Principio X)

- [X] T046 [P] Documentar en el README o en `docs/` que ya hablen de `/health` o del logging (buscar con `grep -ri "health\|correlation" README.md docs backend/README.md`) el endpoint `GET /metrics` (público, formato Prometheus, dos familias, etiqueta `unmatched`), la convención `@Sla('<clase>')` con la tabla de `backend/src/shared/metrics/sla.ts` como fuente de verdad, y que el SLA es declarado y no hay alerting. Si no existe ninguna doc de ese tipo, no crear una nueva **Resultado: no existe ningún README ni doc de `/health` o del logging fuera de la constitución y de `specs/`, así que no se creó documentación nueva (Swagger y Postman ya cubren el endpoint).**
- [X] T047 Correr desde `backend/`: `pnpm build` y `pnpm lint` (incluye el chequeo de que `/docs` de Swagger arranca: levantar la app y confirmar que `GET /metrics` figura bajo la etiqueta `metrics` con respuesta 200 `text/plain`); corregir cualquier error de tipos o de lint
- [X] T048 Correr la suite unitaria completa `pnpm test:unit` (incluye `backend/test/architecture.spec.ts` de tsarch) y confirmar que las capas nuevas (`shared/metrics`, `services/metrics`, `controllers/metrics`, `modules/metrics`) no violan las reglas
- [X] T049 `docker info` primero; luego la suite e2e completa `pnpm test:e2e` desde `backend/` y confirmar que todos los e2e previos (027, 028 y anteriores) siguen en verde y que corrió sobre Testcontainers
- [X] T050 Ejecutar la validación manual de [quickstart.md](./quickstart.md) §2 contra la base desechable `t029_pg` (puerto 5544, backend en `PORT=3101`): público, sólo dos familias, 404, 400 de parser, 401 con su ruta, patrón vs path, 50 URLs, stream, coincidencia con el log y tasa de error; al final detener el backend y `docker rm -f t029_pg`. Nunca contra la base de desarrollo
- [X] T051 Confirmar que ningún test existente fue modificado ni borrado: `git status` y `git diff --stat -- "backend/**/*.spec.ts" "backend/test/**"` deben mostrar **sólo archivos nuevos** (los `*.spec.ts`/`*.e2e-spec.ts` creados en esta feature). Reportar cualquier excepción. Dejar los cambios **sin commitear** y proponer al usuario el nombre del commit en español (`feat: …`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias
- **US1 (Phase 3)**: depende de Foundational. Provee el token `REQUEST_METRICS_RECORDER` y el endpoint
- **US2 (Phase 4)**: depende de Foundational y de US1 (T012 provee el token que T019 resuelve)
- **US3 (Phase 5) y US4 (Phase 6)**: dependen de US2 (verifican la captura); son independientes entre sí pero editan el mismo archivo e2e, así que se hacen en secuencia
- **US5 (Phase 7)**: depende de Foundational (T006 buckets) y de US1 (T044 necesita el controller; el e2e necesita `GET /metrics`); **no** depende de US2–US4
- **Polish (Phase 8)**: depende de todas las historias deseadas

### Within Each Story

- Tests primero y fallando, luego implementación
- Lógica pura (`shared`) → servicio → controller/módulo → cableado
- Tareas que editan el mismo archivo (`backend/test/metrics.e2e-spec.ts`: T010, T017, T021, T023) van en secuencia

### Parallel Opportunities

- Foundational: T003, T004, T005 y T007 en paralelo; luego T006 y T008
- US1: T009 en paralelo con T010 (archivos distintos)
- US5: T025 y T027 en paralelo; los 15 `@Sla` (T029–T043) en paralelo (un archivo cada uno); T044 después de T011
- US5 puede avanzar en paralelo con US2–US4 una vez hecha US1

---

## Parallel Example: User Story 5

```bash
# Tests y helper juntos:
Task: "T025 sla.spec.ts"
Task: "T027 helpers/route-inventory.ts"

# Tras T026 (sla.ts), los decorators en paralelo (archivos distintos):
Task: "T029 alerts.controller.ts"   Task: "T031 auth.controller.ts"   Task: "T036 orders.controller.ts"
Task: "T037 player.controller.ts"   Task: "T042 user-strategy.controller.ts"   ...
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Setup + Foundational
2. US1 (`/metrics` público) y US2 (captura en el hook de la 028)
3. **STOP y VALIDAR**: `/metrics` con 401/404/400/5xx contabilizados y coincidencia con el log. US1 sola sólo expone las familias vacías, por eso el MVP es US1 + US2

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 + US2 → métricas reales (MVP)
3. US3 → cardinalidad verificada
4. US4 → tasa de error honesta y stream fuera del histograma
5. US5 → SLA verificable contra el router
6. Polish → build, lint, suites completas, quickstart manual

---

## Notes

- [P] = archivos distintos, sin dependencias
- [Story] mapea la tarea a su historia de `spec.md`
- Riesgo conocido (plan): las métricas viven dentro de los callbacks de `pino-http`; `customLogLevel` nunca debe devolver `silent` (T016 lo fija)
- La duración es el entero en milisegundos de `pino-http` / 1000: una request de menos de 1 ms mide 0 s (aceptado; el menor umbral de SLA es 100 ms)
- Los umbrales del SLA son objetivos declarados; el documento de visión no está en el repo (ver Assumptions de la spec)
- Principio IX: no modificar ni borrar tests existentes; si alguno hubiera que tocarlo, reportarlo y pedir permiso
- Detenerse en cada checkpoint para validar la historia
